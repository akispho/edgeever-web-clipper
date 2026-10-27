import type {Template} from '../types/types';
import type {ClipInput} from './edgeever-note-creator';
export function captureClipOperation(template:Pick<Template,'behavior'>,fields:Omit<ClipInput,'behavior'|'now'>):ClipInput {
 // Copy tags as well so later form changes cannot alter this operation.
 return Object.freeze({...fields,...(fields.tags ? {tags:[...fields.tags]} : {}),behavior:template.behavior});
}
