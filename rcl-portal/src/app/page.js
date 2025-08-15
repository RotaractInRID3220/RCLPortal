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
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        xx
    </div>
  );
}
