import {
	BuildEnvironmentVariable,
	BuildSpec,
	ComputeType,
	LinuxBuildImage,
	mergeBuildSpecs,
	Project,
	ProjectProps,
} from "aws-cdk-lib/aws-codebuild";
import { Stack } from "aws-cdk-lib";
import { IAction } from "aws-cdk-lib/aws-codepipeline";
import {
	CloudFormationExecuteChangeSetAction,
	CodeBuildAction,
	ManualApprovalAction,
} from "aws-cdk-lib/aws-codepipeline-actions";

import { Artifact } from "./artifact";
import { Segment, SegmentConstructed } from "./segment";
import { Pipeline } from "./pipeline";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

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

		const prepareChangesProject = new Project(this, "PrepareChanges", {
			environment: {
				computeType: ComputeType.MEDIUM,
				buildImage: LinuxBuildImage.AMAZON_LINUX_2_ARM_3,
			},
			buildSpec: BuildSpec.fromObject({
				version: 0.2,
				phases: {
					install: {
						"runtime-versions": {
							nodejs: "24",
						},
						commands: "npm install -g aws-cdk",
					},
					build: {
						commands: `npx cdk deploy ${props.stack.node.id} --app ./ --method prepare-change-set --change-set-name pipeline-${props.stack.node.id}-${this.name} --require-approval never`,
					},
				},
				cache: {
					paths: ["/root/.npm/**/*"],
				},
			}),
		});

		prepareChangesProject.addToRolePolicy(
			new PolicyStatement({
				actions: [
					"ssm:GetParameter",
					"cloudformation:CreateChangeSet",
					"cloudformation:DescribeChangeSet",
					"cloudformation:DescribeStacks",
					"cloudformation:GetTemplate",
					"cloudformation:DeleteChangeSet",
					"iam:PassRole",
				],
				resources: ["*"],
			}),
		);

		prepareChangesProject.addToRolePolicy(
			new PolicyStatement({
				actions: ["sts:AssumeRole"],
				resources: [`arn:*:iam::${Stack.of(this).account}:role/*`],
				conditions: {
					"ForAnyValue:StringEquals": {
						"iam:ResourceTag/aws-cdk:bootstrap-role": [
							"image-publishing",
							"file-publishing",
							"deploy",
						],
					},
				},
			}),
		);

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
										"base-directory": scope.buildDir,
										files: ["**/*"],
									},
								}),
						  )
						: BuildSpec.fromObject({
								artifacts: {
									"base-directory": scope.buildDir,
									files: ["**/*"],
								},
						  }),
				}),
			}),
			new CodeBuildAction({
				actionName: "PrepareChanges",
				runOrder: 2,
				input: buildArtifact,
				project: prepareChangesProject,
			}),
			...(props.manualApproval
				? [
						new ManualApprovalAction({
							actionName: "ApproveChanges",
							runOrder: 3,
						}),
				  ]
				: []),
			new CloudFormationExecuteChangeSetAction({
				actionName: "ExecuteChanges",
				runOrder: props.manualApproval ? 3 : 4,
				stackName: props.stack.stackName,
				account: props.stack.account,
				region: props.stack.region,
				changeSetName: `pipeline-${props.stack.node.id}-${this.name}`,
			}),
		];
	}
}

export function isPipeline(item: Segment): item is PipelineSegment {
	return item.isPipeline;
}
