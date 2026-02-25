import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function DashboardPage() {
  const [stats, setStats] = useState({ members: 0, overdue: 0, upcoming: 0 });

  useEffect(() => {
    (async () => {
      const members = await api.get("/users");
      const all = members.data as any[];
      const overdue = all.filter((u) => u.paymentStatus === "UNPAID").length;
      setStats({ members: all.length, overdue, upcoming: 0 });
    })();
  }, []);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <div className="grid grid-2">
        <div className="card">
          <h3>Total Members</h3>
          <p style={{ fontSize: 28 }}>{stats.members}</p>
        </div>
        <div className="card">
          <h3>Payments Unpaid</h3>
          <p style={{ fontSize: 28 }}>{stats.overdue}</p>
        </div>
      </div>
    </div>
  );
}
