import { Stack } from "aws-cdk-lib";
import {
	BuildEnvironmentVariable,
	BuildEnvironmentVariableType,
	BuildSpec,
	ComputeType,
	LinuxBuildImage,
	mergeBuildSpecs,
	Project,
	ProjectProps,
} from "aws-cdk-lib/aws-codebuild";
import { IAction } from "aws-cdk-lib/aws-codepipeline";
import {
	CloudFormationExecuteChangeSetAction,
	CodeBuildAction,
	ManualApprovalAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { IRole, PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as path from "path";

import { Artifact } from "./artifact";
import { Segment, SegmentConstructed } from "./segment";
import { Pipeline } from "./pipeline";

export interface StackSegmentProps {
	/**
	 * The stack to be deployed in this segment.
	 */
	readonly stack: Stack;
	/**
	 * The input arfifact for the build stage.
	 */
	readonly input: Artifact | Artifact[];
	/**
	 * The command(s) to build the stack.
	 * @example "cdk synth StackName --strict --exclusively"
	 */
	readonly project?: ProjectProps;
	/**
	 * The role for the build stage.
	 */
	readonly role?: IRole;
	/**
	 * The environmental variables for the build stage.
	 */
	readonly environmentVariables?: { [key: string]: BuildEnvironmentVariable };
	/**
	 * The artifact to hold the output of the build if this stack includes a build.
	 */
	readonly buildOutput?: Artifact;
	/**
	 * The artifact to hold the stack deployment output file.
	 */
	readonly stackOutput?: Artifact;
	/**
	 * The filename for the file in the output artifact
	 * @default "artifact.json"
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
export class StackSegment extends Segment {
	readonly props: StackSegmentProps;

	constructor(props: StackSegmentProps) {
		super({
			...props,
			output: [props.buildOutput, props.stackOutput].filter((a) => !!a),
		});
		this.props = props;
	}

	construct(scope: Pipeline): SegmentConstructed {
		return new StackSegmentConstructed(
			scope,
			`Deploy${this.props.stack.node.id}`,
			{
				...this.props,
				input: this.inputs[0],
				extraInputs: this.inputs.slice(1),
			},
		);
	}
}

export interface StackSegmentConstructedProps {
	readonly stack: Stack;
	readonly project?: ProjectProps;
	readonly environmentVariables?: { [key: string]: BuildEnvironmentVariable };
	readonly input: Artifact;
	readonly extraInputs?: Artifact[];
	readonly buildOutput?: Artifact;
	readonly stackOutput?: Artifact;
	readonly outputFileName?: string;
	readonly manualApproval?: Boolean;
}

export class StackSegmentConstructed extends SegmentConstructed {
	readonly name: string;
	readonly actions: IAction[];

	constructor(
		scope: Pipeline,
		id: string,
		props: StackSegmentConstructedProps,
	) {
		super(scope, id);

		this.name = props.stack.node.id;

		const buildArtifact = props.project
			? props.buildOutput || new Artifact()
			: undefined;

		const codeBuildProject = new Project(this, "UpdateCodeBuild", {
			...props.project,
			buildSpec: props.project?.buildSpec
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
		});

		Object.entries(
			props.project?.environment?.environmentVariables || [],
		).forEach(([, v]) => {
			switch (v.type) {
				case BuildEnvironmentVariableType.PARAMETER_STORE:
					codeBuildProject.addToRolePolicy(
						new PolicyStatement({
							actions: [
								"ssm:GetParameter",
								"ssm:GetParameters",
								"ssm:GetParametersByPath",
							],
							resources: [
								`arn:aws:ssm:*:${Stack.of(this).account}:parameter/${v.value}`,
							],
						}),
					);
					break;
				case BuildEnvironmentVariableType.SECRETS_MANAGER:
					codeBuildProject.addToRolePolicy(
						new PolicyStatement({
							actions: [
								"secretsmanager:GetSecretValue",
								"secretsmanager:DescribeSecret",
							],
							resources: [
								(v.value as string).startsWith("arn:")
									? v.value.split(":").slice(0, 7).join(":")
									: `arn:aws:secretsmanager:*:${
											Stack.of(this).account
									  }:secret:${v.value}-*`,
							],
						}),
					);
					break;
			}
		});

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
			...(buildArtifact
				? [
						new CodeBuildAction({
							actionName: `${this.name}Build`,
							runOrder: 1,
							input: props.input,
							extraInputs: props.extraInputs,
							outputs: [buildArtifact],
							environmentVariables: props.environmentVariables,
							project: codeBuildProject,
						}),
				  ]
				: []),
			new CodeBuildAction({
				actionName: `${this.name}PrepareChanges`,
				runOrder: buildArtifact ? 2 : 1,
				input: buildArtifact ? buildArtifact : props.input,
				project: prepareChangesProject,
			}),
			...(props.manualApproval
				? [
						new ManualApprovalAction({
							actionName: `${this.name}ApproveChanges`,
							runOrder: buildArtifact ? 3 : 2,
						}),
				  ]
				: []),
			new CloudFormationExecuteChangeSetAction({
				actionName: `${this.name}ExecuteChanges`,
				runOrder: props.manualApproval
					? buildArtifact
						? 4
						: 3
					: buildArtifact
					  ? 3
					  : 2,
				stackName: props.stack.stackName,
				account: props.stack.account,
				region: props.stack.region,
				changeSetName: `pipeline-${props.stack.node.id}-${this.name}`,
				output: props.stackOutput,
				outputFileName: props.outputFileName
					? props.outputFileName
					: props.stackOutput
					  ? "artifact.json"
					  : undefined,
			}),
		];
	}
}
