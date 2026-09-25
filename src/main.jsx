import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { toast } from '@/components/ui/use-toast'

window.addEventListener('unhandledrejection', (event) => {
  toast({title:'Unable to complete the request',description:event.reason?.message || 'Please try again.',variant:'destructive'});
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
