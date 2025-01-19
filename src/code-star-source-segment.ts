import { IAction } from "aws-cdk-lib/aws-codepipeline";
import { CodeStarConnectionsSourceAction } from "aws-cdk-lib/aws-codepipeline-actions";

import { Pipeline } from "./pipeline";
import { Artifact } from "./artifact";
import { SegmentConstructed } from "./segment";
import { SourceSegment, SourceSegmentProps } from "./source-segment";

export interface CodeStarSourceSegmentProps extends SourceSegmentProps {
  /**
   * The owning user or organization of the repository.
   * @example `"aws"`
   */
  readonly owner: string;
  /**
   * The ARN of the CodeStar Connection created in the AWS console
   * that has permissions to access this GitHub or BitBucket repository.
   * @example `"arn:aws:codestar-connections:us-east-1:123456789012:connection/12345678-abcd-12ab-34cdef5678gh"`
   * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/connections-create.html
   */
  readonly connectionArn: string;
  /**
   * The name of the repository.
   * @example `"aws-cdk"`
   */
  readonly repository: string;
  /**
   * The branch to build.
   * @default `"master"`
   */
  readonly branch?: string;
  readonly triggerOnPush?: boolean;
  readonly variablesNamespace?: string;
}

/**
 * @category Segments
 */
export class CodeStarSourceSegment extends SourceSegment {
  private props: CodeStarSourceSegmentProps;
  constructor(props: CodeStarSourceSegmentProps) {
    super(props);
    this.props = props;
  }
  construct(scope: Pipeline): SegmentConstructed {
    return new CodeStarSourceSegmentConstructed(scope, this.props.repository, {
      ...this.props,
      actionName: `${this.props.owner}/${this.props.repository}/${
        this.props.branch || "master"
      }`,
      repo: this.props.repository,
    });
  }
}

export interface CodeStarSourceSegmentConstructedProps {
  readonly output: Artifact;
  readonly actionName: string;
  readonly connectionArn: string;
  readonly owner: string;
  readonly repo: string;
  readonly branch?: string;
  readonly runOrder?: number;
  readonly triggerOnPush?: boolean;
  readonly variablesNamespace?: string;
}

export class CodeStarSourceSegmentConstructed extends SegmentConstructed {
  readonly name: string;
  readonly actions: IAction[];
  constructor(
    scope: Pipeline,
    id: string,
    props: CodeStarSourceSegmentConstructedProps,
  ) {
    super(scope, id);
    this.name = "Source";
    this.actions = [new CodeStarConnectionsSourceAction(props)];
  }
}
