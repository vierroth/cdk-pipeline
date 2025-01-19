import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Pipeline as AwsPipeline,
  IAction,
  PipelineType,
} from "aws-cdk-lib/aws-codepipeline";
import * as path from "path";

import { Segment } from "./segment";
import { isSource } from "./source-segment";
import { isPipeline } from "./pipeline-segment";

export interface PipelineProps extends StackProps {
  /**
   * The name of the generated pipeline.
   * @default Stack ID
   */
  readonly pipelineName?: string;
  /**
   * The path to the cdk projects root directory containing the cdk.json file
   * relative to the asset root
   * @default `"."`
   */
  readonly rootDir?: string;
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

    this.pipelineName = props.pipelineName || id;
    this.rootDir = props.rootDir || ".";
    this.buildDir = path.join(this.rootDir, (this.node.root as App).outdir);

    if (!this.bundlingRequired) return;

    props.segments.forEach((segment) => {
      segment.inputs.forEach((artifact) => {
        if (!artifact.producer) {
          throw new Error("Artifact consumed but never produced.");
        }
      });
    });

    const sourceSegments = props.segments.filter(isSource);
    const pipelineSegments = props.segments.filter(isPipeline);

    if (pipelineSegments.length < 1) {
      throw new Error(
        "Missing pipeline segment, one instance of the pipeline segment is required in the segments array.",
      );
    }

    if (pipelineSegments.length > 1) {
      throw new Error(
        "To many pipeline segment, only one instance of the pipeline segment can be present in the segments array.",
      );
    }

    const segments: Segment[] = props.segments.filter(
      (segment) => !isSource(segment) && !isPipeline(segment),
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
              (actions, segment) => [
                ...actions,
                ...segment.construct(this).actions,
              ],
              [] as IAction[],
            ),
          ],
        },
        {
          stageName: "Pipeline",
          actions: [...pipelineSegments[0].construct(this).actions],
        },
        ...segments.map((segment) => {
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
