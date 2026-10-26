import type {Template} from '../types/types';
import type {ClipInput} from './edgeever-note-creator';
export function captureClipOperation(template:Pick<Template,'behavior'>,fields:Omit<ClipInput,'behavior'|'now'>):ClipInput {
 // All fields are primitive values: later template/tab/form changes cannot alter this operation.
 return Object.freeze({...fields,behavior:template.behavior});
}
