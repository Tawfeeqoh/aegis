import type {Metadata, Viewport} from 'next';import './globals.css';
export const metadata:Metadata={title:'AEGIS | Agent financial control',description:'Financial permissions, exact approvals and adversarial tests for autonomous agents.',icons:{icon:'/favicon.svg'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content',themeColor:'#101b1c',colorScheme:'dark'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
