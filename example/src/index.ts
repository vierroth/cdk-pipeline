import { App } from "aws-cdk-lib";
import {
  Pipeline,
  CodeStarSourceSegment,
  PipelineSegment,
  StackSegment,
  Artifact,
} from "@flit/cdk-pipeline";
import {
  BuildSpec,
  ComputeType,
  LinuxBuildImage,
} from "aws-cdk-lib/aws-codebuild";

import { TestStack1 } from "./stacks/test-stack-1.js";
import { TestStack2 } from "./stacks/test-stack-2.js";

const APP = new App();

const TEST_STACK_1 = new TestStack1(APP, "TestStack1", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const TEST_STACK_2 = new TestStack2(APP, "TestStack2", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const SOURCE_ARTIFACT = new Artifact();
const PIPELINE_BUILD_ARTIFACT = new Artifact();

new Pipeline(APP, "ExamplePipeline", {
  rootDir: "example/",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  segments: [
    new CodeStarSourceSegment({
      output: SOURCE_ARTIFACT,
      connectionArn:
        "arn:aws:codeconnections:eu-central-1:248111704443:connection/9ae5e5cd-940d-4996-ab75-9b90881b8870",
      owner: "vierroth",
      repository: "cdk-pipeline",
      branch: "main",
    }),
    new PipelineSegment({
      input: SOURCE_ARTIFACT,
      output: PIPELINE_BUILD_ARTIFACT,
      project: {
        buildSpec: BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              "runtime-versions": {
                nodejs: "latest",
              },
              commands: ["npm ci"],
            },
            build: {
              commands: ["npm run build"],
            },
          },
          cache: {
            paths: ["/root/.npm/**/*"],
          },
        }),
      },
    }),
    new StackSegment({
      stack: TEST_STACK_1,
      input: PIPELINE_BUILD_ARTIFACT,
    }),
    new StackSegment({
      stack: TEST_STACK_2,
      input: PIPELINE_BUILD_ARTIFACT,
    }),
  ],
});
