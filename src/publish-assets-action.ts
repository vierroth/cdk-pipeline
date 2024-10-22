import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  ActionBindOptions,
  ActionConfig,
  ActionProperties,
  Artifact,
  IAction,
  IStage,
} from "aws-cdk-lib/aws-codepipeline";
import { BuildSpec, LinuxBuildImage, Project } from "aws-cdk-lib/aws-codebuild";
import { CodeBuildAction } from "aws-cdk-lib/aws-codepipeline-actions";
import {
  AccountPrincipal,
  CompositePrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { IRuleTarget, RuleProps, Rule } from "aws-cdk-lib/aws-events";
import * as path from "path";

export interface PublishAssetsActionProps {
  readonly actionName: string;
  readonly input: Artifact;
  readonly manifestPath: string;
  readonly runOrder?: number;
}

export class PublishAssetsAction extends Construct implements IAction {
  public readonly actionProperties: ActionProperties;

  bound(
    scope: Construct,
    stage: IStage,
    options: ActionBindOptions,
  ): ActionConfig {
    throw new Error(`Method not implemented.${!scope && !stage! && options}`);
  }

  bind(
    scope: Construct,
    stage: IStage,
    options: ActionBindOptions,
  ): ActionConfig {
    throw new Error(`Method not implemented.${!scope && !stage! && options}`);
  }

  onStateChange(
    name: string,
    target?: IRuleTarget | undefined,
    options?: RuleProps | undefined,
  ): Rule {
    throw new Error(`Method not implemented.${!name && !target! && options}`);
  }

  constructor(scope: Construct, id: string, props: PublishAssetsActionProps) {
    super(scope, id);
    const codeBuild = new CodeBuildAction({
      ...props,
      input: props.input,
      project: new Project(this, id, {
        environment: {
          buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
        },
        role: new Role(this, "UpdatePipelineCodeCuildRole", {
          assumedBy: new CompositePrincipal(
            new ServicePrincipal("codebuild.amazonaws.com"),
            new AccountPrincipal(Stack.of(this).account),
          ),
          inlinePolicies: {
            selfMutation: new PolicyDocument({
              statements: [
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
              ],
            }),
          },
        }),
        buildSpec: BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              "runtime-versions": {
                nodejs: "latest",
              },
              commands: ["npm i -g npm@latest @flit/publish-cdk-assets@latest"],
            },
            build: {
              commands: `pca ${
                props.manifestPath ? path.normalize(props.manifestPath) : "."
              }`,
            },
          },
        }),
      }),
    });

    this.actionProperties = codeBuild.actionProperties;
    this.bind = (
      scope: Construct,
      stage: IStage,
      options: ActionBindOptions,
    ): ActionConfig => codeBuild.bind(scope, stage, options);
    this.onStateChange = (
      name: string,
      target?: IRuleTarget,
      options?: RuleProps,
    ): Rule => codeBuild.onStateChange(name, target, options);
  }
}
