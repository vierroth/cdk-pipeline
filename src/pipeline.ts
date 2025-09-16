import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
	Pipeline as AwsPipeline,
	IAction,
	PipelineType,
} from "aws-cdk-lib/aws-codepipeline";
import * as path from "path";

import { isSegment, Segment, SegmentConstructed } from "./segment";
import { isSource } from "./source-segment";
import { isPipeline } from "./pipeline-segment";

export interface SegmentGroup {
	readonly stageName?: string;
	readonly segments: Segment[];
}

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
	readonly segments: (Segment | Segment[] | SegmentGroup)[];
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

		const stages = props.segments.map((segment) =>
			Array.isArray(segment)
				? { stageName: undefined, segments: segment }
				: isSegment(segment)
				  ? { stageName: undefined, segments: [segment] }
				  : segment,
		);

		stages.forEach((stage) => {
			stage.segments.forEach((segment) => {
				segment.inputs.forEach((artifact) => {
					if (!artifact.producer) {
						throw new Error("Artifact consumed but never produced.");
					}
				});
			});
		});

		if (
			stages[0].segments.filter(isSource).length !== stages[0].segments.length
		) {
			throw new Error("First segment must contain only source segments");
		}

		if (
			stages.slice(1).find((stage) => stage.segments.filter(isSource).length)
		) {
			throw new Error("Only the first segment can contain source segments");
		}

		if (
			stages[1].segments.length !== 1 ||
			stages[1].segments.filter(isPipeline).length !== stages[1].segments.length
		) {
			throw new Error("Second segment must be the pipeline segment");
		}

		if (
			stages.slice(2).find((stage) => stage.segments.filter(isPipeline).length)
		) {
			throw new Error("Only the second segment can be the pipeline segment");
		}

		new AwsPipeline(this, "Pipeline", {
			pipelineName: props.pipelineName,
			restartExecutionOnUpdate: true,
			pipelineType: PipelineType.V2,
			stages: [
				{
					stageName: stages[0].stageName || "Source",
					actions: [
						...stages[0].segments.reduce(
							(actions, segment) => [
								...actions,
								...segment.construct(this).actions,
							],
							[] as IAction[],
						),
					],
				},
				{
					stageName: stages[1].stageName || "Pipeline",
					actions: [
						...stages[1].segments.reduce(
							(actions, segment) => [
								...actions,
								...segment.construct(this).actions,
							],
							[] as IAction[],
						),
					],
				},
				...stages.slice(2).map((stage) => {
					const builds = stage.segments.reduce(
						(segments, segment) => [...segments, segment.construct(this)],
						[] as SegmentConstructed[],
					);
					return {
						stageName:
							stage.stageName || builds.map((build) => build.name).join("-"),
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
