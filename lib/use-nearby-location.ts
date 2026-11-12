"use client";

import {useCallback, useEffect, useRef, useState} from 'react';

/** Visitor coordinates stay in memory and are requested only by an explicit action. */
export function useNearbyLocation() {
  const request = useRef(0);
  const [state, setState] = useState<{coordinates:[number,number]|null;locating:boolean;error:''|'geolocationUnsupported'|'geolocationError';session:number}>({coordinates:null,locating:false,error:'',session:0});
  useEffect(() => () => { request.current++; }, []);
  const clear = useCallback(() => {
    request.current++;
    setState({coordinates:null,locating:false,error:'',session:0});
  }, []);
  const locate = useCallback(() => {
    if (!navigator.geolocation) { setState({coordinates:null,locating:false,error:'geolocationUnsupported',session:0}); return; }
    const session = ++request.current;
    setState({coordinates:null,locating:true,error:'',session});
    navigator.geolocation.getCurrentPosition(position => {
      if (session === request.current) setState({coordinates:[position.coords.latitude,position.coords.longitude],locating:false,error:'',session});
    }, () => {
      if (session === request.current) setState({coordinates:null,locating:false,error:'geolocationError',session});
    });
  }, []);
  return {...state,clear,locate};
}
