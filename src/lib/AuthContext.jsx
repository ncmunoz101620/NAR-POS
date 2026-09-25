import React,{createContext,useContext,useEffect,useState} from 'react';
import {api} from '@/api/client';
const AuthContext=createContext(null);
export function AuthProvider({children}) {
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[authError,setError]=useState(null);
 const checkUserAuth=async()=>{try{setUser(await api.auth.me());setError(null);}catch(e){setUser(null);if(e.status!==401)setError({type:'unknown',message:e.message});}finally{setLoading(false);}};
 useEffect(()=>{checkUserAuth();},[]);
 return <AuthContext.Provider value={{user,isAuthenticated:!!user,isLoadingAuth:loading,isLoadingPublicSettings:false,authChecked:!loading,authError,logout:api.auth.logout,navigateToLogin:api.auth.redirectToLogin,checkUserAuth,checkAppState:checkUserAuth}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
