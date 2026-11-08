export default {
 poweredByHeader:false,
 experimental:{webpackMemoryOptimizations:true},
 async headers(){return [{source:'/(.*)',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'SAMEORIGIN'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
  ,{key:'Content-Security-Policy',value:"frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://testnet.mynearwallet.com https://app.mynearwallet.com"}
 ]}];}
};
