let csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
export async function request(path, method = 'GET', data) {
  if (method !== 'GET' && !csrf) csrf = (await (await fetch('/api/csrf', { credentials: 'same-origin' })).json()).token;
  const multipart = data instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}) },
    body: data === undefined ? undefined : multipart ? data : JSON.stringify(data),
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(Object.values(result?.errors || {}).flat()[0] || result?.message || 'Request failed'), {status:response.status, data:result});
  }
  return result;
}
const entities = Object.fromEntries(['Product','Category','Ingredient','RawMaterial','Recipe','PaymentMethod','Setting','AppUser','Role','AuditLog','InventoryTransaction','StockLedger','StockTransfer','Order'].map(name => {
  const path = `/entities/${name}`;
  const list = (sort = '-created_date', limit = 2000, filter = {}) => {
    if (name === 'Order' && filter.order_number) return request(`/track?${new URLSearchParams({ number: filter.order_number, token: new URLSearchParams(location.search).get('token') || localStorage.getItem('order_token_' + filter.order_number) || '' })}`);
    return request(`${path}?${new URLSearchParams({sort, limit:String(limit), filter:JSON.stringify(filter)})}`);
  };
  const create = async data => {
    const result = await request(name === 'Order' ? '/orders' : path, 'POST', data);
    if (name === 'Order') localStorage.setItem('order_token_' + result.order_number, result.tracking_token);
    return result;
  };
  return [name, { list, filter:(filter,sort,limit)=>list(sort,limit,filter), get:id=>request(`${path}/${id}`), create,
    update:(id,data)=>request(name === 'Order' ? `/orders/${id}` : `${path}/${id}`,'PATCH',data),
    delete:id=>request(name === 'Order' ? `/orders/${id}` : `${path}/${id}`,'DELETE'),
    bulkCreate:rows=>request(`/imports/${name}`,'POST',{rows}),
  }];
}));
export const api = {
  entities,
  auth: {
    me:()=>request('/auth/me'), isAuthenticated:()=>request('/auth/me').then(()=>true).catch(()=>false),
    providers:()=>request('/auth/providers'),
    loginViaEmailPassword:(email,password)=>request('/auth/login','POST',{email,password}),
    register:data=>request('/auth/register','POST',data), verifyOtp:data=>request('/auth/verify','POST',data),
    resendOtp:()=>request('/auth/resend','POST'), resetPasswordRequest:email=>request('/auth/forgot','POST',{email}),
    resetPassword:({resetToken,newPassword})=>request('/auth/reset','POST',{token:resetToken,password:newPassword,email:new URLSearchParams(location.search).get('email')}),
    logout:async()=>{await request('/auth/logout','POST'); location.href='/login';},
    redirectToLogin:()=>{location.href='/login';},
    loginWithProvider:(_provider,destination='/login-redirect')=>{location.href='/auth/google?returnTo='+encodeURIComponent(destination);},
  },
  upload: async (file, purpose='catalog') => { const data=new FormData(); data.append('file',file); data.append('purpose',purpose); return request('/uploads','POST',data); },
};
