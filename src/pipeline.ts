import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Pipeline as AwsPipeline,
  IAction,
  PipelineType,
} from "aws-cdk-lib/aws-codepipeline";
import * as path from "path";

import { Artifact } from "./artifact";
import { Segment } from "./segment";
import { SourceSegment } from "./source-segment";
import { PipelineSegment } from "./pipeline-segment";

export interface PipelineProps extends StackProps {
  /**
   * The name of the generated pipeline.
   * @default Stack ID
   */
  readonly pipelineName?: string;
  /**
   * The path to the cdk projects root directory containing the cdk.json file
   * relative to the asset root
   */
  readonly rootDir: string;
  /**
   * The segments to populating the pipeline.
   */
  readonly segments: Segment[];
}

/**
 * @category Constructs
 */
export class Pipeline extends Stack {
  readonly pipelineName: string;
  readonly rootDir: string;
  readonly buildDir: string;

  constructor(
    scope: Construct,
    id: string,
    readonly props: PipelineProps,
  ) {
    super(scope, id, props);

    this.pipelineName = props.pipelineName ? props.pipelineName : id;
    this.rootDir = props.rootDir;
    this.buildDir = path.join(this.rootDir, (this.node.root as App).outdir);

    if (!this.bundlingRequired) return;

    props.segments.forEach((segment: Segment) => {
      segment.inputs.forEach((artifact: Artifact) => {
        if (!artifact.obtainProducer())
          throw new Error("Artifact consumed but never produced.");
      });
    });

    const sourceSegments: SourceSegment[] = props.segments.filter(
      (segment: Segment) => segment.isSource,
    ) as SourceSegment[];

    const pipelineSegment: PipelineSegment | undefined = props.segments.find(
      (segment: Segment) => segment.isPipeline,
    ) as PipelineSegment;

    const segments: Segment[] = props.segments.filter(
      (segment: Segment) => !segment.isSource && !segment.isPipeline,
    );

    new AwsPipeline(this, "Pipeline", {
      pipelineName: props.pipelineName,
      restartExecutionOnUpdate: true,
      pipelineType: PipelineType.V2,
      stages: [
        {
          stageName: "Source",
          actions: [
            ...sourceSegments.reduce(
              (actions: IAction[], segment: SourceSegment) => [
                ...actions,
                ...segment.construct(this).actions,
              ],
              [],
            ),
          ],
        },
        {
          stageName: "Pipeline",
          actions: [...pipelineSegment.construct(this).actions],
        },
        ...segments.map((segment: Segment) => {
          const build = segment.construct(this);
          return {
            stageName: build.name,
            actions: build.actions,
          };
        }),
      ],
    });
  }
}
