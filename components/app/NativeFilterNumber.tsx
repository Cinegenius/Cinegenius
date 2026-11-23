"use client";
import { useState, type InputHTMLAttributes } from "react";

/** Numeric Smart requests commit at the field boundary; typing cannot start a
 * full search for every intermediate digit. Other directories filter locally. */
export default function NativeFilterNumber({ value, onCommit, defer = false, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>,"value"|"onChange"> & {
  value:string;onCommit:(value:string)=>void;defer?:boolean;
}) {
  const [draft,setDraft]=useState(value);
  return <input {...props} type="number" inputMode="decimal" value={defer?draft:value}
    onChange={event => {setDraft(event.target.value);if(!defer)onCommit(event.target.value);}}
    onBlur={event => {if(defer)onCommit(event.target.value);}}
    onKeyDown={event => {if(defer&&event.key==="Enter"){event.preventDefault();event.currentTarget.blur();}}}/>;
}
