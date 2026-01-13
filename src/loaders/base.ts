import type { Loader, LoaderContext } from '../core/types.js';

/**
 * Abstract base class for configuration loaders
 */
export abstract class BaseLoader<TOptions = unknown> implements Loader<TOptions> {
  abstract readonly name: string;

  abstract load(
    options: TOptions,
    context: LoaderContext
  ): Promise<Record<string, unknown>>;
}
