import sharp from 'sharp';
import {MAX_MESSAGE_FILE_BYTES} from './message-attachments';

export function attachmentFilename(value:string) {
  return value.normalize('NFC').replace(/[\u0000-\u001f\u007f/\\\u202a-\u202e\u2066-\u2069]/g,'_').slice(0,180).trim()||'file';
}
function isDocx(bytes:Buffer) {
  // Inspect the bounded central directory; never extract or execute an archive.
  let end=-1;
  for(let n=bytes.length-22;n>=Math.max(0,bytes.length-65557);n--)if(bytes.readUInt32LE(n)===0x06054b50){end=n;break;}
  if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))return false;
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
  if(count<2||count>2048||start+size>end)return false;
  const names=new Set<string>();let offset=start,total=0;
  for(let i=0;i<count;i++){
    if(offset+46>start+size||bytes.readUInt32LE(offset)!==0x02014b50||(bytes.readUInt16LE(offset+8)&1))return false;
    const length=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32);
    if(offset+46+length+extra+comment>start+size)return false;
    const name=bytes.subarray(offset+46,offset+46+length).toString('utf8');total+=bytes.readUInt32LE(offset+24);
    if(total>100*1024*1024||/(^|\/)\.\.(\/|$)|vbaproject|activex/i.test(name))return false;
    names.add(name);offset+=46+length+extra+comment;
  }
  return offset===start+size&&names.has('[Content_Types].xml')&&names.has('word/document.xml');
}
export async function prepareMessageAttachment(bytes:Buffer,name:string) {
  if(!bytes.length||bytes.length>MAX_MESSAGE_FILE_BYTES)throw new Error('attachmentInvalid');
  const extension=name.split('.').at(-1)?.toLowerCase();
  if(['jpg','jpeg','png','webp'].includes(extension??'')) {
    try {
      const image=sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning'}),meta=await image.metadata();
      if(!['jpeg','png','webp'].includes(meta.format??''))throw new Error('invalid');
      // Match the existing private-image pipeline; strip EXIF from a new upload.
      const output=await image.rotate().webp({quality:86}).toBuffer();
      if(output.length>MAX_MESSAGE_FILE_BYTES)throw new Error('invalid');
      return {bytes:output,mime:'image/webp',extension:'webp'};
    }catch{throw new Error('attachmentInvalid');}
  }
  if(extension==='pdf'&&bytes.subarray(0,5).toString('ascii')==='%PDF-')return {bytes,mime:'application/pdf',extension:'pdf'};
  if(extension==='docx'&&isDocx(bytes))return {bytes,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',extension:'docx'};
  if(extension==='txt'){
    try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))throw new Error();return {bytes,mime:'text/plain',extension:'txt'};}catch{/* Unsupported binary file. */}
  }
  throw new Error('attachmentInvalid');
}
