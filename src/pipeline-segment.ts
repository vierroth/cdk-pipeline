import {
	BuildEnvironmentVariable,
	BuildSpec,
	mergeBuildSpecs,
	Project,
	ProjectProps,
} from "aws-cdk-lib/aws-codebuild";
import { Stack } from "aws-cdk-lib";
import { IAction } from "aws-cdk-lib/aws-codepipeline";
import {
	CloudFormationCreateReplaceChangeSetAction,
	CloudFormationExecuteChangeSetAction,
	CodeBuildAction,
	ManualApprovalAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import * as path from "path";

import { Artifact } from "./artifact";
import { Segment, SegmentConstructed } from "./segment";
import { Pipeline } from "./pipeline";
import { PublishAssetsAction } from "./publish-assets-action";

export interface PipelineSegmentProps {
	/**
	 * The input arfifact for the build stage.
	 */
	readonly input: Artifact | Artifact[];
	/**
	 * The command(s) to build the stack.
	 * @example "cdk synth StackName --strict --exclusively"
	 */
	readonly project: ProjectProps;
	/**
	 * The environmental variables for the build stage.
	 */
	readonly environmentVariables?: { [key: string]: BuildEnvironmentVariable };
	/**
	 * The name of the stack to apply this action to.
	 * @default The name of the given stack.
	 */
	readonly stackName?: string;
	/**
	 * The artifact to hold the stack deployment output file.
	 * @default no output artifact
	 */
	readonly output?: Artifact;
	/**
	 * The filename for the file in the output artifact
	 * @default artifact.json
	 */
	readonly outputFileName?: string;
	/**
	 * Does this stage require manual approval of the change set?
	 * @default false
	 */
	readonly manualApproval?: Boolean;
}

/**
 * @category Segments
 */
export class PipelineSegment extends Segment {
	readonly isPipeline = true;
	readonly props: PipelineSegmentProps;

	constructor(props: PipelineSegmentProps) {
		super(props);
		this.props = props;
	}

	construct(scope: Pipeline): SegmentConstructed {
		return new PipelineSegmentConstructed(scope, `Deploy${scope.node.id}`, {
			...this.props,
			stack: scope,
			input: this.inputs[0],
			extraInputs: this.inputs.slice(1),
		});
	}
}

export interface PipelineSegmentConstructedProps {
	readonly stack: Stack;
	readonly project: ProjectProps;
	readonly environmentVariables?: { [key: string]: BuildEnvironmentVariable };
	readonly stackName?: string;
	readonly input: Artifact;
	readonly extraInputs?: Artifact[];
	readonly output?: Artifact;
	readonly outputFileName?: string;
	readonly manualApproval?: Boolean;
}

export class PipelineSegmentConstructed extends SegmentConstructed {
	readonly name: string;
	readonly actions: IAction[];

	constructor(
		scope: Pipeline,
		id: string,
		props: PipelineSegmentConstructedProps,
	) {
		super(scope, id);

		this.name = props.stack.stackName;

		const buildArtifact = props.output || new Artifact();

		this.actions = [
			new CodeBuildAction({
				actionName: "Build",
				runOrder: 1,
				input: props.input,
				extraInputs: props.extraInputs,
				outputs: [buildArtifact],
				environmentVariables: props.environmentVariables,
				project: new Project(this, "UpdateCodeBuild", {
					...props.project,
					buildSpec: props.project.buildSpec
						? mergeBuildSpecs(
								props.project.buildSpec,
								BuildSpec.fromObject({
									artifacts: {
										files: [path.join(scope.buildDir, "**/*")],
									},
								}),
						  )
						: BuildSpec.fromObject({
								artifacts: {
									files: [path.join(scope.buildDir, "**/*")],
								},
						  }),
				}),
			}),
			new PublishAssetsAction(this, "PublishAssets", {
				actionName: "PublishAssets",
				runOrder: 2,
				input: buildArtifact,
				manifestPath: scope.buildDir,
			}),
			new CloudFormationCreateReplaceChangeSetAction({
				actionName: "PrepareChanges",
				runOrder: 3,
				stackName: props.stackName ? props.stackName : props.stack.stackName,
				account: props.stack.account,
				region: props.stack.region,
				changeSetName: `${this.name}Changes`,
				adminPermissions: true,
				templatePath: buildArtifact.atPath(
					path.join(scope.buildDir, props.stack.templateFile),
				),
			}),
			...(props.manualApproval
				? [
						new ManualApprovalAction({
							actionName: "ApproveChanges",
							runOrder: 4,
						}),
				  ]
				: []),
			new CloudFormationExecuteChangeSetAction({
				actionName: "ExecuteChanges",
				runOrder: props.manualApproval ? 5 : 4,
				stackName: props.stackName ? props.stackName : props.stack.stackName,
				account: props.stack.account,
				region: props.stack.region,
				changeSetName: `${this.name}Changes`,
			}),
		];
	}
}

export function isPipeline(item: Segment): item is PipelineSegment {
	return item.isPipeline;
}
