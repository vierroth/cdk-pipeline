import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Pipeline as AwsPipeline,
  IAction,
  PipelineType,
} from "aws-cdk-lib/aws-codepipeline";
import * as path from "path";

import { Segment, SegmentConstructed } from "./segment";
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
   * @default "."
   */
  readonly rootDir?: string;
  /**
   * The segments to populating the pipeline.
   */
  readonly segments: (Segment | Segment[])[];
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

    const segments = props.segments.map((segment) =>
      Array.isArray(segment) ? segment : [segment],
    );

    segments.forEach((unit) => {
      unit.forEach((segment) => {
        segment.inputs.forEach((artifact) => {
          if (!artifact.producer) {
            throw new Error("Artifact consumed but never produced.");
          }
        });
      });
    });

    if (segments[0].filter(isSource).length !== segments[0].length) {
      throw new Error("First segment must contain only source segments");
    }

    if (segments.slice(1).find((unit) => unit.filter(isSource).length)) {
      throw new Error("Only the first segment can contain source segments");
    }

    if (
      segments[1].length === 1 &&
      segments[1].filter(isPipeline).length !== segments[0].length
    ) {
      throw new Error("Second segment must be the pipeline segment");
    }

    if (segments.slice(2).find((unit) => unit.filter(isPipeline).length)) {
      throw new Error("Only the second segment can be the pipeline segment");
    }

    new AwsPipeline(this, "Pipeline", {
      pipelineName: props.pipelineName,
      restartExecutionOnUpdate: true,
      pipelineType: PipelineType.V2,
      stages: [
        {
          stageName: "Source",
          actions: [
            ...segments[0].reduce(
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
          actions: [
            ...segments[1].reduce(
              (actions, segment) => [
                ...actions,
                ...segment.construct(this).actions,
              ],
              [] as IAction[],
            ),
          ],
        },
        ...segments.slice(2).map((unit) => {
          const builds = unit.reduce(
            (segments, segment) => [...segments, segment.construct(this)],
            [] as SegmentConstructed[],
          );
          return {
            stageName: builds.map((build) => build.name).join(""),
            actions: builds.reduce(
              (actions, build) => [...actions, ...build.actions],
              [] as IAction[],
            ),
          };
        }),
      ],
    });
  }
}
