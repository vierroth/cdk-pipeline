import { IAction } from "aws-cdk-lib/aws-codepipeline";
import {
	GitHubSourceAction,
	GitHubTrigger,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { SecretValue } from "aws-cdk-lib";

import { Pipeline } from "./pipeline";
import { Artifact } from "./artifact";
import { SegmentConstructed } from "./segment";
import { SourceSegment, SourceSegmentProps } from "./source-segment";

export interface GitHubSourceSegmentProps extends SourceSegmentProps {
	readonly oauthToken: SecretValue;
	/**
	 * The owning user or organization of the repository.
	 * @example "aws"
	 */
	readonly owner: string;
	/**
	 * The name of the repository.
	 * @example "aws-cdk"
	 */
	readonly repository: string;
	/**
	 * The branch to build.
	 * @default "master"
	 */
	readonly branch?: string;
	readonly trigger?: GitHubTrigger;
	readonly variablesNamespace?: string;
}

/**
 * @category Segments
 */
export class GitHubSourceSegment extends SourceSegment {
	private props: GitHubSourceSegmentProps;
	constructor(props: GitHubSourceSegmentProps) {
		super(props);
		this.props = props;
	}
	construct(scope: Pipeline): SegmentConstructed {
		const name = `${this.props.owner}-${this.props.repository}-${
			this.props.branch || "master"
		}`;

		return new GitHubSourceSegmentConstructed(scope, name, {
			...this.props,
			actionName: name,
			repo: this.props.repository,
		});
	}
}

export interface GitHubSourceSegmentConstructedProps {
	readonly output: Artifact;
	readonly actionName: string;
	readonly oauthToken: SecretValue;
	readonly owner: string;
	readonly repo: string;
	readonly branch?: string;
	readonly runOrder?: number;
	readonly trigger?: GitHubTrigger;
	readonly variablesNamespace?: string;
}

export class GitHubSourceSegmentConstructed extends SegmentConstructed {
	readonly name: string;
	readonly actions: IAction[];
	constructor(
		scope: Pipeline,
		id: string,
		props: GitHubSourceSegmentConstructedProps,
	) {
		super(scope, id);
		this.name = "Source";
		this.actions = [new GitHubSourceAction(props)];
	}
}
