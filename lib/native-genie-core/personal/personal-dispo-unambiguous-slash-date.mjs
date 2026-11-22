// Complete numeric slash dates with exactly one component order. No locale inference.
export function validUnambiguousSlashDate(iso,literal) {
  if(typeof iso!=='string'||typeof literal!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(iso))return false;
  const m=literal.trim().match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/u);if(!m)return false;
  const a=Number(m[1]),b=Number(m[2]),year=Number(m[3]);let day,month;
  if(a>12&&b>=1&&b<=12){day=a;month=b;}
  else if(b>12&&a>=1&&a<=12){day=b;month=a;}
  else return false;
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return false;
  return Number(iso.slice(0,4))===year&&Number(iso.slice(5,7))===month&&Number(iso.slice(8))===day;
}
