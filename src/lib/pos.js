import {api} from '@/api/client';
export async function updateOrderStatus(order,status,userName,cookName,reason){return api.entities.Order.update(order.id,{status,...(cookName?{cook_name:cookName}:{}),...(reason?{reason}:{})});}
export async function loadSettings(){return (await api.entities.Setting.list())[0] || null;}
