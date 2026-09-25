import {api} from '@/api/client';
export const BRANCHES=['NAR Commi','NAR Greenwoods'];
export async function getLedgerRow(itemId,itemType,branch){return (await api.entities.StockLedger.filter({item_id:itemId,item_type:itemType,branch}))[0] || null;}
