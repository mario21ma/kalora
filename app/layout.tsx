import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Kalora · Tvoj dnevnik prehrane',description:'Jednostavan dnevnik kalorija i makronutrijenata na hrvatskom.',manifest:'/manifest.json',appleWebApp:{capable:true,title:'Kalora',statusBarStyle:'default'},icons:{icon:'/icon-192.png',apple:'/apple-touch-icon.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#17634d'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="hr" suppressHydrationWarning><body>{children}</body></html>}
