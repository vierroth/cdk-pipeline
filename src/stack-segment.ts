import { Stack } from "aws-cdk-lib";
import {
  BuildEnvironmentVariable,
  BuildSpec,
  mergeBuildSpecs,
  Project,
  ProjectProps,
} from "aws-cdk-lib/aws-codebuild";
import { IAction } from "aws-cdk-lib/aws-codepipeline";
import {
  CloudFormationCreateReplaceChangeSetAction,
  CloudFormationExecuteChangeSetAction,
  CodeBuildAction,
  ManualApprovalAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { IRole } from "aws-cdk-lib/aws-iam";
import * as path from "path";

import { Artifact } from "./artifact";
import { Segment, SegmentConstructed } from "./segment";
import { Pipeline } from "./pipeline";
import { PublishAssetsAction } from "./publish-assets-action";

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
   * The name of the stack to deploy the changes to.
   * @deafult The name of the given stack.
   */
  readonly stackName?: string;
  /**
   * The AWS account this Action is supposed to operate in.
   */
  readonly account?: string;
  /**
   * The AWS region the given Action resides in.
   */
  readonly region?: string;
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
export class StackSegment extends Segment {
  readonly props: StackSegmentProps;

  constructor(props: StackSegmentProps) {
    super(props);
    this.props = props;
  }

  construct(scope: Pipeline): SegmentConstructed {
    return new StackSegmentConstructed(
      scope,
      `Deploy${this.props.stack.stackName}`,
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
  readonly stackName?: string;
  readonly account?: string;
  readonly region?: string;
  readonly input: Artifact;
  readonly extraInputs?: Artifact[];
  readonly output?: Artifact;
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

    this.name = props.stack.stackName;

    const buildArtifact = props.project ? new Artifact() : undefined;

    this.actions = [
      ...(buildArtifact
        ? [
            new CodeBuildAction({
              actionName: "Build",
              runOrder: 1,
              input: props.input,
              extraInputs: props.extraInputs,
              outputs: [buildArtifact],
              environmentVariables: props.environmentVariables,
              project: new Project(this, "UpdateCodeBuild", {
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
              }),
            }),
            new PublishAssetsAction(this, "PublishAssets", {
              actionName: "PublishAssets",
              runOrder: 2,
              input: buildArtifact,
              manifestPath: scope.buildDir,
            }),
          ]
        : []),
      new CloudFormationCreateReplaceChangeSetAction({
        actionName: "PrepareChanges",
        runOrder: buildArtifact ? 3 : 1,
        stackName: props.stackName ? props.stackName : props.stack.stackName,
        account: props.account,
        region: props.region,
        changeSetName: `${props.stack.stackName}Changes`,
        adminPermissions: true,
        templatePath: (buildArtifact ? buildArtifact : props.input).atPath(
          path.join(scope.buildDir, props.stack.templateFile),
        ),
      }),
      ...(props.manualApproval
        ? [
            new ManualApprovalAction({
              actionName: "ApproveChanges",
              runOrder: buildArtifact ? 4 : 2,
            }),
          ]
        : []),
      new CloudFormationExecuteChangeSetAction({
        actionName: "ExecuteChanges",
        runOrder: props.manualApproval
          ? buildArtifact
            ? 5
            : 3
          : buildArtifact
            ? 4
            : 2,
        stackName: props.stackName ? props.stackName : props.stack.stackName,
        account: props.account,
        region: props.region,
        changeSetName: `${props.stack.stackName}Changes`,
        output: props.output,
        outputFileName: props.outputFileName
          ? props.outputFileName
          : props.output
            ? `artifact.json`
            : undefined,
      }),
    ];
  }
}
