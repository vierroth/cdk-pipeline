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
  readonly owner: string;
  readonly repository: string;
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
    return new GitHubSourceSegmentConstructed(scope, this.props.repository, {
      ...this.props,
      actionName: this.props.repository,
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
