import type {Galaxy, Relation, Word} from './lexicon-data';

export type ImportedCatalogue = {words: Word[]; relations: Relation[]; title: string; categoryMode: 'section' | 'semantic'; categoryLabels: Partial<Record<Galaxy, {labelZh: string; label: string}>>};

export function createImportedCatalogue(words: Word[], title: string): ImportedCatalogue;
export function appendImportedCatalogue(current: ImportedCatalogue | null, batch: Word[]): ImportedCatalogue;

export function resolveCatalogue<T, U>(imported: T | null | undefined, builtIn: U): T | U;
