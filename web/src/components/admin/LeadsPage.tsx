"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState, formatDate, LoadError } from "@/components/learner/parts";
import { FilterBar, matches, SearchInput } from "@/components/facility/parts";
import { Card, Table, Td, Th } from "@/components/ui";
import { data } from "@/lib/data";
import { useQuery } from "@/lib/data/hooks";

/**
 * Demo requests from the public website (F5.9, decision D9 — not in the sitemap yet;
 * confirm with the client whether leads live here or go to a CRM).
 */
export function LeadsPage() {
  const q = useQuery("leads", () => data.listLeads());
  const [search, setSearch] = useState("");
  const rows = (q.data ?? []).filter((l) => matches(search, l.name, l.email, l.organization, l.role));

  return (
    <>
      <PageHeader title="Demo Requests" description="Requests submitted through the public website's demo form." />
      <FilterBar>
        <SearchInput label="Search" placeholder="Name, email or organization" value={search} onChange={setSearch} />
      </FilterBar>
      {q.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
      {q.status === "error" && <LoadError error={q.error} onRetry={q.refetch} />}
      {q.status === "success" &&
        (rows.length === 0 ? (
          <EmptyState title={q.data.length ? "No requests match" : "No demo requests yet"}>
            Requests from the website&apos;s “Request a Demo” form appear here.
          </EmptyState>
        ) : (
          <Card>
            <Table>
              <caption className="sr-only">Demo requests</caption>
              <thead>
                <tr>
                  <Th>Received</Th>
                  <Th>Name</Th>
                  <Th>Organization</Th>
                  <Th>Contact</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <Td className="whitespace-nowrap">{formatDate(l.createdAt)}</Td>
                    <Td>
                      <span className="font-medium">{l.name}</span>
                      {l.role && <div className="text-xs text-muted">{l.role}</div>}
                    </Td>
                    <Td>
                      {l.organization}
                      {l.facilities && <div className="text-xs text-muted">{l.facilities} facilit{l.facilities === "1" ? "y" : "ies"}</div>}
                    </Td>
                    <Td>
                      <a href={`mailto:${l.email}`} className="text-primary hover:underline">
                        {l.email}
                      </a>
                      {l.phone && <div className="text-xs text-muted">{l.phone}</div>}
                    </Td>
                    <Td className="max-w-xs text-sm">{l.message ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
    </>
  );
}
