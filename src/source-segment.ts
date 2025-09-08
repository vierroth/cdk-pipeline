import { Artifact } from "./artifact";
import { Segment } from "./segment";

export interface SourceSegmentProps {
	readonly output: Artifact;
}

export abstract class SourceSegment extends Segment {
	readonly isSource = true;
}

export function isSource(item: Segment): item is SourceSegment {
	return item.isSource;
}
