"use client";
import {useState} from 'react';
import {Check, Copy} from 'lucide-react';

export default function CodeBlock({code, label}: {code: string; label: string}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  return <div className="docs-code"><div><span>{label}</span><button aria-label={`Copy ${label}`} onClick={async () => {try {await navigator.clipboard.writeText(code); setCopied(true); setError(''); setTimeout(() => setCopied(false), 1800);} catch {setError('Select and copy the code below.');}}}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy'}</button></div><pre><code>{code}</code></pre>{error && <p role="status">{error}</p>}</div>;
}
