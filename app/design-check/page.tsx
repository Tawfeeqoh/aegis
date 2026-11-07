import {notFound} from 'next/navigation';
import Review from './review';
export default function DesignCheck() {
  if (process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV !== 'development') notFound();
  return <Review/>;
}
