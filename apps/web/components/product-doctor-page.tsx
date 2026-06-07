"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { API_BASE_URL } from "../lib/api";

type DoctorResponse = {
  product: {
    id: string;
    title: string;
    wbNmId: string;
    brand: string;
    category: string;
    price: number;
    stock: number;
    rating: number;
    description?: string | null;
  };
  diagnosis: {
    seoScore: number;
    imageScore: number;
    titleScore: number;
    descriptionScore: number;
    attributeCompleteness: number;
    reviewRisk: string;
    returnRisk: string;
    diagnosis: string[];
    suggestions: string[];
    seoTitleRu: string;
    seoDescriptionRu: string;
    seoBulletsRu: string[];
    keywordsRu: string[];
    warnings: string[];
    missingData: string[];
  };
};

export function ProductDoctorPage({ productId }: { productId: string }) {
  const [token, setToken] = useState("");
  const [data, setData] = useState<DoctorResponse | null>(null);
  const [message, setMessage] = useState("Dang tai Product Doctor...");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem("wb-dashboard-token");
    if (!stored) {
      setMessage("Chua co token dang nhap. Hay quay lai dashboard.");
      return;
    }

    setToken(stored);
    fetch(`${API_BASE_URL}/products/${productId}/doctor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored}`
      }
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message ?? "Khong the tao Product Doctor");
        }
        return payload as DoctorResponse;
      })
      .then((payload) => {
        setData(payload);
        setMessage("Da tao Product Doctor draft.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Khong the tai Product Doctor."));
  }, [productId]);

  function refresh() {
    if (!token) return;
    startTransition(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}/doctor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message ?? "Khong the lam moi Product Doctor.");
        }
        setData(payload as DoctorResponse);
        setMessage("Da lam moi Product Doctor draft.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Khong the lam moi Product Doctor.");
      }
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="panel p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="eyebrow">Product Doctor</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{data?.product.title ?? "Dang phan tich SKU"}</h1>
              <p className="mt-2 text-sm text-slate-300">Draft SEO/Listing chi de seller duyet, chua tu dong update content san pham.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="button-secondary" href="/">Quay lai dashboard</Link>
              <button className="button-primary" disabled={pending} onClick={refresh}>
                {pending ? "Dang lam moi..." : "Lam moi draft"}
              </button>
            </div>
          </div>
          <p className="toast mt-4">{message}</p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: "SEO Score", value: data?.diagnosis.seoScore ?? "--" },
            { label: "Image Score", value: data?.diagnosis.imageScore ?? "--" },
            { label: "Title Score", value: data?.diagnosis.titleScore ?? "--" },
            { label: "Description Score", value: data?.diagnosis.descriptionScore ?? "--" },
            { label: "Attribute Completeness", value: data?.diagnosis.attributeCompleteness ?? "--" },
            { label: "Rating", value: data?.product.rating?.toFixed(1) ?? "--" }
          ].map((card) => (
            <div key={card.label} className="metric-card">
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="panel p-5">
            <h2 className="text-2xl font-semibold text-white">Chan doan</h2>
            <div className="mt-4 grid gap-3">
              {data?.diagnosis.diagnosis.map((item) => (
                <div key={item} className="soft-card text-sm text-slate-200">{item}</div>
              ))}
            </div>
            <div className="soft-card mt-4">
              <p className="font-medium text-white">Review Risk</p>
              <p className="mt-2 text-sm text-slate-300">{data?.diagnosis.reviewRisk}</p>
            </div>
            <div className="soft-card mt-4">
              <p className="font-medium text-white">Return Risk</p>
              <p className="mt-2 text-sm text-slate-300">{data?.diagnosis.returnRisk}</p>
            </div>
            <div className="soft-card mt-4">
              <p className="font-medium text-white">Warnings</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(data?.diagnosis.warnings ?? []).map((warning) => (
                  <span key={warning} className="chip">{warning}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-2xl font-semibold text-white">AI draft bang tieng Nga</h2>
            <div className="mt-4 grid gap-4">
              <div className="soft-card">
                <p className="text-sm text-slate-400">Title moi</p>
                <p className="mt-2 text-white">{data?.diagnosis.seoTitleRu}</p>
              </div>
              <div className="soft-card">
                <p className="text-sm text-slate-400">Description moi</p>
                <p className="mt-2 text-white">{data?.diagnosis.seoDescriptionRu}</p>
              </div>
              <div className="soft-card">
                <p className="text-sm text-slate-400">Bullet points</p>
                <div className="mt-3 grid gap-2">
                  {(data?.diagnosis.seoBulletsRu ?? []).map((item) => (
                    <div key={item} className="text-sm text-slate-200">{item}</div>
                  ))}
                </div>
              </div>
              <div className="soft-card">
                <p className="text-sm text-slate-400">Keywords</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(data?.diagnosis.keywordsRu ?? []).map((keyword) => (
                    <span key={keyword} className="chip">{keyword}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
