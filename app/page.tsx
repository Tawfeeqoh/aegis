import Aegis from './ui';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const allowed=process.env.VERCEL_ENV==='preview'||process.env.NODE_ENV==='development';
  const params=allowed?await searchParams:{};
  const fixture=typeof params.fixture==='string'&&['empty','one','worst','1000'].includes(params.fixture)?params.fixture:undefined;
  return <Aegis fixture={fixture} largeText={!!fixture&&params.text==='large'}/>;
}
