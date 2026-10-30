import { PluginKey } from 'prosemirror-state';

/** Marks a transaction after which the plugins read the fields of every formula again. */
export const formulaRefreshKey = new PluginKey('formulaRefresh');
