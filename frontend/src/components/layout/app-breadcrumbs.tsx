"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

export function AppBreadcrumbs() {
  const pathname = usePathname();
  
  const segments = pathname.split("/").filter(Boolean);
  
  if (segments.length === 0) {
    return null; // Don't show breadcrumbs on the home/dashboard page itself
  }
  
  const buildBreadcrumbs = () => {
    let currentPath = "";
    return segments.map((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      
      // Format the label
      const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

      // Truncate long mongo-like IDs (heuristic: length > 20)
      const isId = segment.length >= 20;
      const displayLabel = isId ? `${segment.slice(0, 6)}...${segment.slice(-4)}` : label;

      return (
        <Fragment key={currentPath}>
          <BreadcrumbItem>
            {isLast ? (
              <BreadcrumbPage>{displayLabel}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={currentPath}>{displayLabel}</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator />}
        </Fragment>
      );
    });
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.length > 0 && <BreadcrumbSeparator />}
        {buildBreadcrumbs()}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
