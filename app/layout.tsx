import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'AEGIS | Agent financial control',description:'Financial permissions, exact approvals and adversarial tests for autonomous agents.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
