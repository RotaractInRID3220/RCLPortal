'use client'
import Image from "next/image";
import { supabase } from "../lib/supabaseClient";
import { useEffect, useState } from "react";

export default function Home() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [insertStatus, setInsertStatus] = useState(null);
  const [nameInput, setNameInput] = useState("");



  return (
    <div className="mt-20 flex space-x-10 items-center justify-center">
        <a href="/admin/dashboard" className="bg-cranberry/80 hover:bg-cranberry w-96 py-4 cursor-pointer items-center text-center justify-center rounded-lg">Admin portal</a>
        <a href="/portal/dashboard" className="bg-cranberry/80 hover:bg-cranberry w-96 py-4 cursor-pointer items-center text-center justify-center rounded-lg">Council portal</a>
    </div>
  );
}
