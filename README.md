This library exposes a highly customizable and extensible L3 pipeline construct intended as an alternative to the CDK native L3 [CodePipeline](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.pipelines.CodePipeline.html) construct which has some inherent limitations in capability and extensibility.

The documentation provides the tools and documentation to get your own pipeline up and running and build your own custom segments.

## Usage

### Installation

The package is available on [NPM](https://www.npmjs.com) and can be installed using your package manager of choice:

```bash
npm i @flit/cdk-pipeline

pnpm add @flit/cdk-pipeline

yarn add @flit/cdk-pipeline
```

### Basics

The snippet bellow is a basic example of a pipeline which will run whenever a change is detected in a GitHub repository and which will update itself and deploy and update a user defined stack. This example demonstrates the three basic elements that make up a pipeline:

#### - Pipeline

The Pipeline construct will create a CloudFormation Stack which contains the pipeline and all of the required peripheral resources to make it work.

#### - Segment

A Segment is simply a pre-configured set of pipeline actions which together represent a commonly used CI/CD pattern, like for example building and deploying a stack.

To build properly, a Pipeline requires at least one SourceSegment, exactly one PipelineSegment and at least one other segment.

#### - Artifact

An Artifact represents a pipeline artifact which can be used to pass information between stages. Every artifact needs to be the output of exactly one Segment and can be consumed by any segments that need that output.

```typescript
import { App, SecretValue, Stack } from "aws-cdk-lib";
import {
  Pipeline,
  GitHubSourceSegment,
  PipelineSegment,
  StackSegment,
  Artifact,
} from "@flit/cdk-pipeline";

const APP = new App();

const sourceArtifact = new Artifact();

new Pipeline(APP, "Pipeline", {
  rootDir: "./",
  segments: [
    new GitHubSourceSegment({
      oauthToken: SecretValue.secretsManager("github-access-token"),
      output: sourceArtifact,
      owner: "owner-name",
      repository: "repo-name",
      branch: "branch-name",
    }),
    new PipelineSegment({
      input: sourceArtifact,
      command: "cdk synth Pipeline --strict --exclusively",
    }),
    new StackSegment({
      stack: new Stack(APP, "Stack1"),
      input: sourceArtifact,
      command: "cdk synth Stack1 --strict --exclusively",
    }),
  ],
});
```

### Multiple stacks

To add another stack to the pipeline you simply add another `StackSegment` with a new stack instance and the pipeline will handle the rest.

```typescript
import { App, SecretValue, Stack } from "aws-cdk-lib";
import {
  Pipeline,
  GitHubSourceSegment,
  PipelineSegment,
  StackSegment,
  Artifact,
} from "@flit/cdk-pipeline";

const APP = new App();

const sourceArtifact = new Artifact();

new Pipeline(APP, "Pipeline", {
  rootDir: "./",
  segments: [
    new GitHubSourceSegment({
      oauthToken: SecretValue.secretsManager("github-access-token"),
      output: sourceArtifact,
      owner: "owner-name",
      repository: "repo-name",
      branch: "branch-name",
    }),
    new PipelineSegment({
      input: sourceArtifact,
      command: "cdk synth Pipeline --strict --exclusively",
    }),
    new StackSegment({
      stack: new Stack(APP, "Stack1"),
      input: sourceArtifact,
      command: "cdk synth Stack1 --strict --exclusively",
    }),
    new StackSegment({
      stack: new Stack(APP, "Stack2"),
      input: sourceArtifact,
      command: "cdk synth Stack2 --strict --exclusively",
    }),
  ],
});
```

### Passing assets

If a segment requires the output artifact of a previous segment then you can simply add an output artifact to the previous stage and pass it as additional input to another segment.

```typescript
import { App, SecretValue, Stack } from "aws-cdk-lib";
import {
  Pipeline,
  GitHubSourceSegment,
  PipelineSegment,
  StackSegment,
  Artifact,
} from "@flit/cdk-pipeline";

const APP = new App();

const sourceArtifact = new Artifact();
const stack1Artifact = new Artifact();

new Pipeline(APP, "Pipeline", {
  rootDir: "./",
  segments: [
    new GitHubSourceSegment({
      oauthToken: SecretValue.secretsManager("jumper-de-github-access-tokens"),
      output: sourceArtifact,
      owner: "p-mercury",
      repository: "jumper-de",
      branch: "main",
    }),
    new PipelineSegment({
      input: sourceArtifact,
      command: "cdk synth Pipeline --strict --exclusively",
    }),
    new StackSegment({
      stack: new Stack(APP, "Stack1"),
      input: sourceArtifact,
      output: stack1Artifact,
      command: "cdk synth Stack1 --strict --exclusively",
    }),
    new StackSegment({
      stack: new Stack(APP, "Stack2"),
      input: [sourceArtifact, stack1Artifact],
      command: "cdk synth Stack2 --strict --exclusively",
    }),
  ],
});
```

### Building your own segment

The snippet bellow is a basic example showing a custom segment which simply adds a stage with two manual approval steps into the pipeline and allows you to optional give this step a name.

Each segment has two components consisting of two distinct classes:

### - Segment

The main segment class is the class that will be used in your pipeline definition, and can be created by extending the `Segment` abstract class.

This class **should not** itself create any actual CDK constructs and is simply there to collect configuration trough the `constructor`. The `constructor` should take a single parameter called `props` which is a descendant of the `SegmentProps` interface.

The segment class also has to define the `construct` abstract function which returns an instance of a descendant of the `SegmentConstructed` abstract class.

### - SegmentConstructed

This class will be returned by the `construct` function of your segment class and is itself a CDK construct. So in this class you can now allocate the CDK resources this segment requires as you are used to in any other CDK application.

You can pass any configuration information previously collected in the segment class trough the constructor.

```typescript
import { IAction } from "aws-cdk-lib/aws-codepipeline";
import { ManualApprovalAction } from "aws-cdk-lib/aws-codepipeline-actions";

import { Segment, SegmentConstructed } from "./segment";
import { Pipeline } from "./pipeline";

export interface RequireApprovalSegmentProps {
  readonly name?: string;
}

/**
 * @category Segments
 */
export class DoubleApprovalSegment extends Segment {
  readonly props: RequireApprovalSegmentProps;

  constructor(props: RequireApprovalSegmentProps) {
    super({ ...props, input: undefined, output: undefined });
    this.props = props;
  }

  construct(scope: Pipeline): SegmentConstructed {
    return new RequireApprovalSegmentConstructed(
      scope,
      `RequireApproval`,
      this.props,
    );
  }
}

export interface RequireApprovalSegmentConstructedProps {
  readonly name?: string;
}

export class RequireApprovalSegmentConstructed extends SegmentConstructed {
  readonly name: string;
  readonly actions: IAction[];

  constructor(
    scope: Pipeline,
    id: string,
    props: RequireApprovalSegmentConstructedProps,
  ) {
    super(scope, id);

    this.name = props.name ?? id;

    this.actions = [
      new ManualApprovalAction({
        actionName: "ApproveChanges1",
        runOrder: 1,
      }),
      new ManualApprovalAction({
        actionName: "ApproveChanges2",
        runOrder: 2,
      }),
    ];
  }
}
```
