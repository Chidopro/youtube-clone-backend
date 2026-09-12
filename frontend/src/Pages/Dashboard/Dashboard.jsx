import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import './Dashboard.css';
import { supabase } from '../../supabaseClient';
import { SubscriptionService } from '../../utils/subscriptionService';
import { AdminService } from '../../utils/adminService';
import { fetchMyProfileFromBackend, claimSessionTokenIfNeeded } from '../../utils/userService';
import { getBackendUrl, apiJoin } from '../../config/apiConfig';
import { requestVideoOptimize } from '../../utils/videoOptimize';
import { savePendingMerchData, markMerchIntentStarted } from '../../utils/merchSession';
import { favoriteListsJson, fetchFavoritesForList, fetchPublicFavoriteLists, linkOwnerExtraPagesToStorefront } from '../../utils/favoriteListsApi';
import PersonalizationSettings from '../../Components/PersonalizationSettings/PersonalizationSettings.jsx';
import ChannelUmbrella from '../../Components/ChannelUmbrella/ChannelUmbrella.jsx';
import { channelFriendsJson } from '../../utils/channelFriendsApi';
import { useCreator } from '../../contexts/CreatorContext';
import { getSubdomain } from '../../utils/subdomainService';
import { DEMO_DASHBOARD_PATH, DEMO_STOREFRONT_SUBDOMAIN, isDemoPreviewSession, isDemoStorefront, isDemoStorefrontVisitor } from '../../utils/demoStorefront';
import { collaboratorPayoutHeading } from '../../utils/favoriteListLabels';
import '../DemoDashboard/DemoDashboard.css';
// Force Netlify rebuild

/** Auto-generated umbrella list titles should not prefill the nickname field. */
function isUmbrellaAutoPageName(name) {
    const n = (name || '').replace(/\s*\(owner\)\s*/gi, ' ').trim();
    const stripped = n.replace(/\s*Favorites\s*$/i, '').trim();
    return !stripped || /^collaborator$/i.test(stripped);
}

function formatPayoutDate(iso) {
    if (!iso) return '—';
    try {
        const dateOnly = String(iso).slice(0, 10);
        const parts = dateOnly.split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2] && !String(iso).includes('T')) {
            return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
        return new Date(iso).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch (_) {
        return String(iso);
    }
}

function todayPayoutInputDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const COLLAB_SHARE_PER_ITEM = 6;

function saleSoldQuantity(sale) {
    const explicit = Number(sale?.quantity);
    if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
    const share = Number(sale?.collaborator_share_before_fee ?? sale?.pay_owner_amount ?? 0);
    if (share > 0) return Math.max(1, Math.round(share / COLLAB_SHARE_PER_ITEM));
    const payout = Number(sale?.pay_collaborator_amount ?? 0);
    if (payout > 0) return Math.max(1, Math.round(payout / COLLAB_SHARE_PER_ITEM));
    return 1;
}

function saleSoldLabel(sale) {
    const qty = saleSoldQuantity(sale);
    return qty === 1 ? '1 sold' : `${qty} sold`;
}

function productSalesItemCount(data) {
    const fromSold = (data?.products_sold || []).reduce((sum, product) => sum + Number(product.quantity || 0), 0);
    if (fromSold > 0) return fromSold;
    const listed = Number(data?.products_sold_count || 0);
    if (listed > 0) return listed;
    return (data?.fee_sales || []).reduce((sum, sale) => sum + saleSoldQuantity(sale), 0);
}

function money(n) {
    return `$${Number(n || 0).toFixed(2)}`;
}

function timesEquals(count, rate, total) {
    const n = Number(count) || 0;
    const r = Number(rate) || 0;
    const t = Number(total) || 0;
    if (n > 0 && r > 0) return `${n} × ${money(r)} = ${money(t)}`;
    return money(t);
}

function sumEquals(parts, subtracted = []) {
    const shown = (parts || []).filter((n) => Number(n) > 0).map((n) => money(n));
    const minus = (subtracted || []).filter((n) => Number(n) > 0).map((n) => `− ${money(n)}`);
    if (!shown.length && !minus.length) return '';
    return `${shown.join(' + ')}${minus.length ? ` ${minus.join(' ')}` : ''}`;
}

function saleCollaboratorPayoutLabel(sale) {
    const fee = Number(sale?.owner_fee_amount ?? 0);
    const net = Number(sale?.pay_collaborator_amount ?? 0);
    const share = Number(sale?.collaborator_share_before_fee ?? (net + fee));
    if (fee > 0) {
        return `Share ${money(share)} · Fee ${money(fee)} · Payout ${money(net)}`;
    }
    return `Payout ${money(net)}`;
}

function saleDateRangeLabel(sales) {
    const stamps = (sales || []).map((s) => s?.created_at).filter(Boolean).sort();
    if (!stamps.length) return '';
    const first = formatPayoutDate(stamps[0]);
    const last = formatPayoutDate(stamps[stamps.length - 1]);
    return first === last ? last : `${first} – ${last}`;
}

function saleTimeMs(sale) {
    const raw = sale?.created_at;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
}

function parseTimeMs(raw) {
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
}

function sameStamp(a, b) {
    const left = parseTimeMs(a);
    const right = parseTimeMs(b);
    return left > 0 && right > 0 && Math.abs(left - right) < 2000;
}

function payoutRecordedTimeMs(payout) {
    const created = parseTimeMs(payout?.created_at) || parseTimeMs(payout?.recorded_at);
    if (!created) return 0;
    if (sameStamp(payout?.created_at, payout?.payout_date) || sameStamp(payout?.created_at, payout?.paid_at)) {
        return 0;
    }
    return created;
}

function payoutNewestTimeMs(payout) {
    return (
        parseTimeMs(payout?.created_at)
        || parseTimeMs(payout?.recorded_at)
        || parseTimeMs(payout?.paid_at)
        || parseTimeMs(payout?.payout_date)
        || 0
    );
}

function newestPayout(payouts) {
    const rows = (payouts || []).filter(Boolean);
    if (!rows.length) return null;
    return [...rows].sort((a, b) => payoutNewestTimeMs(b) - payoutNewestTimeMs(a))[0];
}

function payoutConfirmedAt(payout) {
    const raw = payout?.confirmed_at;
    return raw ? String(raw) : '';
}

function sortPayoutsNewestFirst(payouts) {
    return [...(payouts || [])]
        .map((payout, apiIndex) => ({ payout, apiIndex }))
        .sort((a, b) => {
            const recorded = payoutRecordedTimeMs(b.payout) - payoutRecordedTimeMs(a.payout);
            if (recorded !== 0) return recorded;
            return a.apiIndex - b.apiIndex;
        })
        .map((row) => row.payout);
}

function saleCreatorShare(sale) {
    const owner = Number(sale?.pay_owner_amount ?? 0);
    if (owner > 0) return owner;
    const beforeFee = Number(sale?.collaborator_share_before_fee ?? 0);
    if (beforeFee > 0) return beforeFee;
    const split = Number(sale?.owner_fee_amount ?? 0) + Number(sale?.pay_collaborator_amount ?? 0);
    if (split > 0) return split;
    return saleSoldQuantity(sale) * COLLAB_SHARE_PER_ITEM;
}

function ownerEarningsFiguresFromSales(ownerSales, collabSales) {
    const owners = ownerSales || [];
    const collabs = collabSales || [];
    const ownerPayout = owners.reduce((sum, s) => sum + Number(s.pay_owner_amount ?? 0), 0);
    const feeAmount = collabs.reduce((sum, s) => sum + Number(s.owner_fee_amount ?? 0), 0);
    const collabPay = collabs.reduce((sum, s) => sum + Number(s.pay_collaborator_amount ?? 0), 0);
    const ownerItems = owners.reduce((sum, s) => sum + saleSoldQuantity(s), 0);
    const feeItems = collabs.reduce((sum, s) => sum + saleSoldQuantity(s), 0);
    const listedFeePerItem = Number(
        collabs.find((s) => Number(s.owner_fee_per_item) > 0)?.owner_fee_per_item
        || (feeItems > 0 && feeAmount > 0 ? feeAmount / feeItems : 0)
    );
    const collabPayPerItem = listedFeePerItem > 0
        ? Math.max(0, COLLAB_SHARE_PER_ITEM - listedFeePerItem)
        : (feeItems > 0 ? collabPay / feeItems : 0);
    const collabShareTotal = feeAmount + collabPay;
    const totalOwnerEarnings = ownerPayout + collabShareTotal - collabPay;
    return {
        ownerSales: owners,
        collabSales: collabs,
        ownerPayout,
        feeAmount,
        collabPay,
        collabShareTotal,
        totalOwnerEarnings,
        ownerItems,
        feeItems,
        listedFeePerItem,
        collabPayPerItem,
        ownerDateLabel: saleDateRangeLabel(owners),
        collaboratorDateLabel: saleDateRangeLabel(collabs),
        qualifyingItems: ownerItems + feeItems,
        qualifyingShare: ownerPayout + collabShareTotal,
        hasActivity: ownerPayout > 0 || collabPay > 0 || feeAmount > 0 || owners.length > 0 || collabs.length > 0,
    };
}

function buildOwnerEarningsPeriods(ownerSales, collabSales, payouts) {
    const newestFirst = sortPayoutsNewestFirst(payouts);
    const tagged = [
        ...(ownerSales || []).map((sale) => ({ kind: 'owner', sale, ts: saleTimeMs(sale) })),
        ...(collabSales || []).map((sale) => ({ kind: 'collab', sale, ts: saleTimeMs(sale) })),
    ].sort((a, b) => {
        const dt = a.ts - b.ts;
        if (dt !== 0) return dt;
        return String(a.sale?.id || '').localeCompare(String(b.sale?.id || ''));
    });
    let cursor = 0;
    const takeForAmount = (amount) => {
        const taken = [];
        let covered = 0;
        const target = Number(amount) || 0;
        while (cursor < tagged.length && (target <= 0 || covered < target - 0.005)) {
            taken.push(tagged[cursor]);
            covered += saleCreatorShare(tagged[cursor].sale);
            cursor += 1;
        }
        return ownerEarningsFiguresFromSales(
            taken.filter((row) => row.kind === 'owner').map((row) => row.sale),
            taken.filter((row) => row.kind === 'collab').map((row) => row.sale),
        );
    };
    const historyOldestFirst = [...newestFirst].reverse().map((payout, i) => ({
        key: String(payout.id ?? `payout-${i}`),
        payout,
        ...takeForAmount(payout.amount),
    }));
    const leftover = tagged.slice(cursor);
    const latest = {
        key: 'latest',
        payout: null,
        ...ownerEarningsFiguresFromSales(
            leftover.filter((row) => row.kind === 'owner').map((row) => row.sale),
            leftover.filter((row) => row.kind === 'collab').map((row) => row.sale),
        ),
    };
    return [latest, ...[...historyOldestFirst].reverse()];
}

function OwnerEarningsFigures({ period, emptyMessage, showItemDetails = true }) {
    if (!period?.hasActivity) {
        return emptyMessage ? <p className="hint">{emptyMessage}</p> : null;
    }
    const {
        ownerPayout,
        feeAmount,
        collabPay,
        collabShareTotal,
        totalOwnerEarnings,
        ownerItems,
        feeItems,
        listedFeePerItem,
        collabPayPerItem,
        ownerSales,
        collabSales,
        ownerDateLabel,
        collaboratorDateLabel,
        qualifyingItems,
        qualifyingShare,
        payout,
    } = period;
    const earningsEquation = sumEquals([ownerPayout, collabShareTotal], [collabPay]);
    return (
        <>
            <ul className="collaborator-payout-list owner-earnings-log-totals owner-earnings-visible">
                {payout ? (
                    <>
                        <li>
                            <div className="collab-payout-row-main">
                                <strong>ScreenMerch paid</strong>
                                <span className="owner-earnings-math">{money(payout.amount)}</span>
                            </div>
                        </li>
                        <li>
                            <div className="collab-payout-row-main">
                                <strong>Qualifying items</strong>
                                <span className="owner-earnings-math">
                                    {timesEquals(qualifyingItems, COLLAB_SHARE_PER_ITEM, qualifyingShare)}
                                </span>
                            </div>
                        </li>
                    </>
                ) : null}
                {ownerPayout > 0 || ownerSales.length > 0 ? (
                    <li>
                        <div className="collab-payout-row-main">
                            <strong>Storefront page sales</strong>
                            <span className="owner-earnings-math">
                                {timesEquals(ownerItems, COLLAB_SHARE_PER_ITEM, ownerPayout)}
                            </span>
                        </div>
                    </li>
                ) : null}
                {feeAmount > 0 ? (
                    <li>
                        <div className="collab-payout-row-main">
                            <strong>Collaborator fees</strong>
                            <span className="owner-earnings-math">
                                {timesEquals(feeItems, listedFeePerItem, feeAmount)}
                            </span>
                        </div>
                    </li>
                ) : null}
                {collabPay > 0 ? (
                    <li>
                        <div className="collab-payout-row-main">
                            <strong>Collaborator payments</strong>
                            <span className="owner-earnings-math">
                                {timesEquals(feeItems, collabPayPerItem, collabPay)}
                            </span>
                        </div>
                    </li>
                ) : null}
                <li className="owner-earnings-total-row">
                    <div className="collab-payout-row-main">
                        <strong>
                            Your Earnings
                            {ownerDateLabel ? (
                                <span className="owner-earnings-date">{ownerDateLabel}</span>
                            ) : null}
                        </strong>
                        <span className="owner-earnings-math">
                            {earningsEquation ? `${earningsEquation} = ` : ''}
                            <span className="owner-earnings-total-amount">
                                {money(totalOwnerEarnings)}
                            </span>
                        </span>
                    </div>
                </li>
            </ul>
            {showItemDetails && ownerSales.length > 0 ? (
                <details className="owner-purchase-log-details owner-earnings-log">
                    <summary>Storefront product sales</summary>
                    <ul className="collaborator-payout-list owner-earnings-log-totals">
                        <li>
                            <div className="collab-payout-row-main">
                                <strong>Storefront earnings</strong>
                                <span>
                                    ${ownerPayout.toFixed(2)}
                                    {ownerDateLabel ? ` · ${ownerDateLabel}` : ''}
                                </span>
                            </div>
                        </li>
                    </ul>
                    <ul className="collaborator-payout-list owner-purchase-log">
                        {ownerSales.map((sale, idx) => (
                            <li key={String(sale.id || idx)}>
                                <div className="collab-payout-row-main">
                                    <strong>{sale.product_name || 'Item'}</strong>
                                    <span>
                                        {sale.display_name || 'Your page'}
                                        {' · '}
                                        {formatPayoutDate(sale.created_at)}
                                        {' · '}
                                        {saleSoldLabel(sale)}
                                        {' · '}
                                        Your payout ${Number(sale.pay_owner_amount ?? 0).toFixed(2)}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
            {showItemDetails && (collabPay > 0 || collabSales.length > 0) ? (
                <details className="owner-purchase-log-details owner-earnings-log">
                    <summary>Collaborator Earnings</summary>
                    <ul className="collaborator-payout-list owner-earnings-log-totals">
                        <li>
                            <div className="collab-payout-row-main">
                                <strong>Collaborator Earnings</strong>
                                <span>
                                    {money(collabPay)}
                                    {collaboratorDateLabel ? ` · ${collaboratorDateLabel}` : ''}
                                </span>
                            </div>
                        </li>
                        {feeAmount > 0 ? (
                            <li>
                                <div className="collab-payout-row-main">
                                    <strong>Fees kept by you</strong>
                                    <span>{money(feeAmount)}</span>
                                </div>
                            </li>
                        ) : null}
                    </ul>
                    {collabSales.length > 0 ? (
                        <ul className="collaborator-payout-list owner-purchase-log">
                            {collabSales.map((sale, idx) => (
                                <li key={String(sale.id || idx)}>
                                    <div className="collab-payout-row-main">
                                        <strong>{sale.product_name || 'Item'}</strong>
                                        <span>
                                            {sale.display_name || 'Collaborator'}
                                            {' · '}
                                            {formatPayoutDate(sale.created_at)}
                                            {' · '}
                                            {saleSoldLabel(sale)}
                                            {' · '}
                                            {saleCollaboratorPayoutLabel(sale)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </details>
            ) : null}
        </>
    );
}

function ownerFeePerItem(feeType, feeValue) {
    const t = String(feeType || 'none').toLowerCase();
    const v = Number(feeValue) || 0;
    if (t === 'percent') {
        return Math.round(COLLAB_SHARE_PER_ITEM * (Math.min(100, Math.max(0, v)) / 100) * 100) / 100;
    }
    if (t === 'flat') {
        return Math.round(Math.min(COLLAB_SHARE_PER_ITEM, Math.max(0, v)) * 100) / 100;
    }
    return 0;
}

function CollaboratorFeeForm({
    listId,
    feeType,
    feeValue,
    onTypeChange,
    onValueChange,
    onSave,
    saving,
    message,
    readOnly = false,
    hideSave = false,
    collaboratorView = false,
    salesFeeAmount = 0,
    salesItemCount = 0,
}) {
    const perItem = ownerFeePerItem(feeType, feeValue);
    const collabKeeps = Math.max(0, COLLAB_SHARE_PER_ITEM - perItem);
    const preview =
        feeType === 'none' || perItem <= 0
            ? 'This creator keeps the full $6.00 per item.'
            : collaboratorView
                ? `The storefront keeps $${perItem.toFixed(2)} of each item; you keep $${collabKeeps.toFixed(2)}.`
                : `You keep $${perItem.toFixed(2)} of each item; they keep $${collabKeeps.toFixed(2)}.`;
    const radioName = `owner-fee-type-${listId}`;
    return (
        <form
            className={`owner-fee-form collab-fee-form${readOnly ? ' collab-fee-form--readonly' : ''}`}
            onSubmit={hideSave ? (e) => e.preventDefault() : onSave}
        >
            <div className="owner-fee-type" role="radiogroup" aria-label="Sales fee for this creator">
                <label>
                    <input
                        type="radio"
                        name={radioName}
                        checked={feeType === 'none'}
                        onChange={() => onTypeChange('none')}
                        disabled={readOnly}
                    />
                    No extra fee
                </label>
                <label>
                    <input
                        type="radio"
                        name={radioName}
                        checked={feeType === 'percent'}
                        onChange={() => onTypeChange('percent')}
                        disabled={readOnly}
                    />
                    Percentage
                </label>
                <label>
                    <input
                        type="radio"
                        name={radioName}
                        checked={feeType === 'flat'}
                        onChange={() => onTypeChange('flat')}
                        disabled={readOnly}
                    />
                    Flat rate / item
                </label>
            </div>
            {feeType !== 'none' ? (
                <label className="owner-fee-value-label">
                    {feeType === 'percent' ? 'Percent of $6.00 share' : 'Dollars per item sold'}
                    <input
                        type="number"
                        min="0"
                        max={feeType === 'percent' ? '100' : '6'}
                        step={feeType === 'percent' ? '1' : '0.25'}
                        value={feeValue}
                        onChange={(e) => onValueChange(e.target.value)}
                        required
                        disabled={readOnly}
                    />
                </label>
            ) : null}
            <p className="owner-fee-preview">{preview}</p>
            {salesItemCount > 0 ? (
                <p className="owner-fee-sales-taken">
                    From recorded sales: {collaboratorView ? 'the storefront keeps' : 'you keep'} {money(salesFeeAmount)}
                    {salesItemCount === 1 ? ' (1 item)' : ` (${salesItemCount} items)`}.
                </p>
            ) : null}
            {hideSave ? null : (
            <button type="submit" className="btn-save-owner-fee" disabled={saving || readOnly}>
                {saving ? 'Saving…' : 'Save rate'}
            </button>
            )}
            {message ? (
                <p className={`owner-fee-message${message.startsWith('Saved') ? ' ok' : ' error'}`}>
                    {message}
                </p>
            ) : null}
        </form>
    );
}

function cleanFavoritePageNickname(raw) {
    return (raw || '')
        .replace(/\s*\(owner\)\s*/gi, ' ')
        .replace(/\s*—?\s*collaborator\s*page\s*/gi, ' ')
        .replace(/\s*Umbrella\s*Page\s*$/i, '')
        .replace(/\s*Favorites\s*$/i, '')
        .trim();
}

function withCollaboratorPageFlags(lists, storefrontOwnerId) {
    return (lists || []).map((L) => {
        const isCollab = !!(
            L.is_collaborator_page
            || (
                L.storefront_owner_id
                && L.owner_user_id
                && String(L.storefront_owner_id) !== String(L.owner_user_id)
            )
            || (
                storefrontOwnerId
                && L.owner_user_id
                && String(L.owner_user_id) !== String(storefrontOwnerId)
            )
        );
        return { ...L, is_collaborator_page: isCollab };
    });
}

function favoritePageSelectLabel(page) {
    if (!page) return 'Pages';
    if (page.is_primary) {
        return 'Main Page';
    }
    if (page.is_collaborator_page) {
        // Prefer saved page display_name (Pom / Gee) over email-derived member_label
        const nick = cleanFavoritePageNickname(
            page.display_name || page.member_label || page.slug
        );
        if (nick && !/^collaborator$/i.test(nick)) return nick;
        const member = cleanFavoritePageNickname(page.member_label);
        return member || 'Friend';
    }
    return cleanFavoritePageNickname(page.display_name) || page.slug || 'Page';
}

function favoritePageNameTaken(pages, name, { ignoreListId } = {}) {
    const target = (name || '').trim().toLowerCase();
    if (!target) return false;
    return (pages || []).some((p) => {
        if (ignoreListId && p.id === ignoreListId) return false;
        const display = (p.display_name || '').trim().toLowerCase();
        const label = favoritePageSelectLabel(p).trim().toLowerCase();
        return display === target || label === target;
    });
}

const Dashboard = ({ sidebar, demoPreview: demoPreviewFromRoute = false }) => {
    const demoPreview = demoPreviewFromRoute || isDemoPreviewSession();
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(demoPreviewFromRoute ? 'analytics' : 'favorites');
    const [umbrellaOnly, setUmbrellaOnly] = useState(false);
    const [umbrellaStatusReady, setUmbrellaStatusReady] = useState(false);
    const [analyticsError, setAnalyticsError] = useState('');
    const { currentCreator, loading: creatorLoading } = useCreator();

    // Open tab when URL has ?tab= (e.g. from navbar logo edit or FrameSnag "Add to Favorites")
    useEffect(() => {
        const tab = searchParams.get('tab');
        const listIdParam = (searchParams.get('list_id') || '').trim();
        if (listIdParam) {
            selectedFavoriteListIdRef.current = listIdParam;
            setSelectedFavoriteListId(listIdParam);
            try {
                localStorage.setItem('screenmerch_framesnag_list_id', listIdParam);
            } catch (_) {}
        }
        if (tab === 'personalization') setActiveTab('personalization');
        if (tab === 'analytics') setActiveTab('analytics');
        if (tab === 'videos') setActiveTab('favorites');
        if (tab === 'favorites') {
            setActiveTab('favorites');
            setShowPasteHint(true); // Show "press Ctrl+V" hint when sent from FrameSnag
        }
    }, [searchParams]);

    useEffect(() => {
        if (demoPreview || !user?.id || userProfile?.role !== 'creator') {
            setUmbrellaOnly(false);
            setUmbrellaStatusReady(true);
            return;
        }
        setUmbrellaStatusReady(false);
        let cancelled = false;
        (async () => {
            try {
                const { ok, data } = await channelFriendsJson('/api/channel-friends/my-umbrella-status', { method: 'GET' });
                if (cancelled) return;
                if (ok && data?.is_umbrella_only) {
                    setUmbrellaOnly(true);
                    const tabParam = new URLSearchParams(window.location.search).get('tab');
                    if (tabParam === 'analytics' || tabParam === 'favorites') {
                        setActiveTab(tabParam);
                    } else {
                        setActiveTab('favorites');
                    }
                } else {
                    setUmbrellaOnly(false);
                }
            } catch (_) {
                if (!cancelled) setUmbrellaOnly(false);
            } finally {
                if (!cancelled) setUmbrellaStatusReady(true);
            }
        })();
        return () => { cancelled = true; };
    }, [user?.id, userProfile?.role]);

    useEffect(() => {
        if (activeTab === 'videos') {
            setActiveTab('favorites');
        }
    }, [activeTab]);

    // Paste-from-FrameSnag: storefront owners only (umbrella collaborators upload manually)
    useEffect(() => {
        if (activeTab !== 'favorites' || umbrellaOnly || demoPreview) return;
        const handlePaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type === 'image/png' || item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) return;
                    const file = new File([blob], `framesnag-${Date.now()}.png`, { type: blob.type || 'image/png' });
                    setEditingFavorite(null);
                    setThumbnailTargetVideoId('');
                    setNewFavorite({
                        title: 'From FrameSnag',
                        description: '',
                        image: file,
                        imagePreview: URL.createObjectURL(blob)
                    });
                    setShowFavoriteModal(true);
                    setShowPasteHint(false); // Hide hint once they pasted
                    break;
                }
            }
        };
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [activeTab, umbrellaOnly, demoPreview]);

    const [currentUser, setCurrentUser] = useState(null);
    const [payoutData, setPayoutData] = useState({
        paypal_email: ''
    });
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [payoutMessage, setPayoutMessage] = useState('');
    const [favorites, setFavorites] = useState([]);
    const [favoritePages, setFavoritePages] = useState([]);
    const [selectedFavoriteListId, setSelectedFavoriteListId] = useState(null);
    const [newPageName, setNewPageName] = useState('');
    const [umbrellaPageName, setUmbrellaPageName] = useState('');
    const [umbrellaOwnerName, setUmbrellaOwnerName] = useState('');
    const [savingFavoritePage, setSavingFavoritePage] = useState(false);
    const [movingFavoriteId, setMovingFavoriteId] = useState(null);
    const selectedFavoriteListIdRef = useRef(null);
    const [uploadingFavorite, setUploadingFavorite] = useState(false);
    const [showFavoriteModal, setShowFavoriteModal] = useState(false);
    const [thumbnailTargetVideoId, setThumbnailTargetVideoId] = useState('');
    const [otherPageVideos, setOtherPageVideos] = useState([]);
    const [editingFavorite, setEditingFavorite] = useState(null);
    const [showPasteHint, setShowPasteHint] = useState(false);
    const [newFavorite, setNewFavorite] = useState({
        title: '',
        description: '',
        image: null,
        imagePreview: null
    });
    const [analyticsData, setAnalyticsData] = useState({
        total_sales: 0,
        total_revenue: 0,
        products_sold_count: 0,
        videos_with_sales_count: 0,
        week_sales_count: null,
        avg_order_value: 0,
        products_sold: [],
        recent_sales: [],
        daily_sales: [],
        page_name: '',
        storefront_owner_name: '',
        collaborator_net_owed: 0,
        paid_total: 0,
        last_payout: null,
        payout_note: '',
        payout_summary: {},
        platform_fee_amount: 0,
        pay_collaborator_amount: 0,
        owner_fee_amount: 0,
        owner_fee_per_item: 0,
        collaborator_share_before_fee: 0,
        fee_sales: [],
        is_paid_up: false,
        owner_fee_type: 'none',
        owner_fee_value: 0,
    });
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [collaboratorPayoutRows, setCollaboratorPayoutRows] = useState([]);
    const [collaboratorOwedTotal, setCollaboratorOwedTotal] = useState(0);
    const [ownerPayoutRows, setOwnerPayoutRows] = useState([]);
    const [ownerRecentSales, setOwnerRecentSales] = useState([]);
    const [ownerEarningsSummary, setOwnerEarningsSummary] = useState(null);
    const [screenmerchPayouts, setScreenmerchPayouts] = useState([]);
    const [screenmerchPaidTotal, setScreenmerchPaidTotal] = useState(0);
    const [screenmerchPendingAmount, setScreenmerchPendingAmount] = useState(0);
    const [nextPayoutDate, setNextPayoutDate] = useState('');
    const [collabFeeDrafts, setCollabFeeDrafts] = useState({});
    const [savingCollabFeeId, setSavingCollabFeeId] = useState(null);
    const [collabFeeMessages, setCollabFeeMessages] = useState({});
    const [analyticsPayoutModal, setAnalyticsPayoutModal] = useState(null);
    const [analyticsPayoutAmount, setAnalyticsPayoutAmount] = useState('');
    const [analyticsPayoutDate, setAnalyticsPayoutDate] = useState('');
    const [analyticsPayoutNote, setAnalyticsPayoutNote] = useState('');
    const [analyticsPayoutError, setAnalyticsPayoutError] = useState('');
    const [recordingAnalyticsPayout, setRecordingAnalyticsPayout] = useState(false);
    const [confirmingCollabReceipt, setConfirmingCollabReceipt] = useState(false);
    const [collabReceiptError, setCollabReceiptError] = useState('');
    const analyticsPayoutIgnoreBackdropUntilRef = useRef(0);
    const analyticsFetchGenRef = useRef(0);
    const recordedCollabPayoutsRef = useRef({});
    const [isMasterAdmin, setIsMasterAdmin] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const [editVideoForm, setEditVideoForm] = useState({
        title: '',
        thumbnail: '',
        video_url: ''
    });
    const [uploadingVideoFile, setUploadingVideoFile] = useState(false);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const modalContentRef = useRef(null);
    

    const navigate = useNavigate();


    useEffect(() => {
        if (demoPreview) return undefined;
        const fetchUserData = async () => {
            try {
                // Check for authenticated user (email login or OAuth)
                const isAuthenticated = localStorage.getItem('isAuthenticated');
                const userData = localStorage.getItem('user');
                
                let user = null;
                
                if (isAuthenticated === 'true' && userData) {
                    // User from localStorage (email login or OAuth)
                    user = JSON.parse(userData);
                    console.log('🔐 Dashboard: Found authenticated user from localStorage:', user);
                } else {
                    // Fallback to Supabase auth
                    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
                    if (supabaseUser) {
                        user = supabaseUser;
                        console.log('🔐 Dashboard: Found Supabase user:', user);
                    }
                }
                
                if (!user) {
                    console.log('🔐 Dashboard: No authenticated user found, redirecting to home');
                    navigate('/');
                    return;
                }

                setUser(user);

                // CRITICAL: Fetch user profile from backend (safe fields only)
                let profile = null;
                if (user.id) {
                    console.log('🔍 [DASHBOARD] Fetching latest profile from backend for user ID:', user.id);
                    profile = await fetchMyProfileFromBackend(user.id);
                    if (profile) {
                        console.log('✅ [DASHBOARD] Fetched profile from backend:', {
                            profile_image_url: profile?.profile_image_url,
                            cover_image_url: profile?.cover_image_url,
                            display_name: profile?.display_name
                        });
                    }
                }

                if (profile) {
                    // CRITICAL: Use database values directly (same as cover_image_url)
                    // Don't override database values with fallbacks - let the image src handle fallbacks
                    const finalProfileImageUrl = profile.profile_image_url || '';
                    const finalCoverImageUrl = profile.cover_image_url || '';
                    
                    // Merge profile with user data - use database values directly
                    const mergedProfile = {
                        ...profile,
                        profile_image_url: finalProfileImageUrl,
                        cover_image_url: finalCoverImageUrl
                    };
                    
                    setUserProfile(mergedProfile);
                    
                    // CRITICAL: Update localStorage with latest database values
                    const updatedUser = {
                        ...user,
                        id: profile.id || user.id,
                        profile_image_url: finalProfileImageUrl,
                        cover_image_url: finalCoverImageUrl,
                        display_name: profile.display_name || user.display_name || user.user_metadata?.name || '',
                        bio: profile.bio || user.bio || ''
                    };
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    console.log('💾 [DASHBOARD] Updated localStorage with profile_image_url:', updatedUser.profile_image_url);
                    
                    // CRITICAL: Also update user state so image src resolution works immediately
                    setUser(updatedUser);
                    console.log('✅ [DASHBOARD] Updated user state with profile_image_url:', updatedUser.profile_image_url);
                    
                    // Load payout data if available
                    setPayoutData({
                        paypal_email: profile.paypal_email || ''
                    });
                } else {
                    // Fallback: For users without database profile, use localStorage data
                    console.log('⚠️ [DASHBOARD] No database profile found, using localStorage data');
                    // Priority: user.profile_image_url > user.picture > user.user_metadata?.picture
                    const profileImageUrl = user.profile_image_url || user.picture || user.user_metadata?.picture || '';
                    const coverImageUrl = user.cover_image_url || '';
                    // Create userProfile object with all available data
                    const userProfileData = {
                        ...user,
                        profile_image_url: profileImageUrl,
                        cover_image_url: coverImageUrl,
                        display_name: user.display_name || user.user_metadata?.name || '',
                        bio: user.bio || ''
                    };
                    setUserProfile(userProfileData);
                }

                // Fetch user subscription
                const userSubscription = await SubscriptionService.getCurrentUserSubscription();
                setSubscription(userSubscription);

                // Fetch user's videos from Supabase (only if user has an ID)
                if (user.id) {
                    const { data: userVideos, error: videosError } = await supabase
                        .from('videos2')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (userVideos) {
                        setVideos(userVideos);
                    }
                    
                } else {
                    // For Google OAuth users without database ID, show empty videos
                    setVideos([]);
                    setFavorites([]);
                }

            } catch (error) {
                console.error('Error fetching data:', error);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate, demoPreview]);

    useEffect(() => {
        if (!demoPreview) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${getBackendUrl()}/api/subdomain/${encodeURIComponent(DEMO_STOREFRONT_SUBDOMAIN)}`);
                const data = await res.json().catch(() => ({}));
                const creator = data?.creator;
                if (cancelled || !creator?.id) {
                    if (!cancelled) setLoading(false);
                    return;
                }
                const previewUser = {
                    id: creator.id,
                    display_name: creator.display_name || DEMO_STOREFRONT_SUBDOMAIN,
                    role: 'creator',
                    subdomain: creator.subdomain || DEMO_STOREFRONT_SUBDOMAIN,
                };
                setUser(previewUser);
                setUserProfile(previewUser);
            } catch (err) {
                console.error('Demo dashboard creator load failed:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [demoPreview]);

    const reloadFavoritesForList = async (userId, listId, pages = favoritePages) => {
        if (!listId) {
            setFavorites([]);
            return;
        }
        const page = pages.find((p) => p.id === listId) || null;
        const storefrontSub = demoPreview
            ? DEMO_STOREFRONT_SUBDOMAIN
            : (getSubdomain() || currentCreator?.subdomain || '');

        if (page && storefrontSub) {
            const favs = await fetchFavoritesForList(
                storefrontSub,
                page,
                page.owner_user_id || userId
            );
            if ((favs || []).length > 0 || demoPreview) {
                setFavorites(favs || []);
                return;
            }
        }

        if (!demoPreview) {
            const { ok, data } = await favoriteListsJson(
                `/api/favorite-lists/favorites?list_id=${encodeURIComponent(listId)}`
            );
            if (ok && Array.isArray(data?.favorites)) {
                setFavorites(data.favorites);
                return;
            }
        }

        if (!userId) {
            setFavorites([]);
            return;
        }
        const favUserId = page?.is_collaborator_page
            ? (page.owner_user_id || userId)
            : userId;
        let { data, error } = await supabase
            .from('creator_favorites')
            .select('*')
            .eq('list_id', listId)
            .order('created_at', { ascending: false });
        if (error || !(data || []).length) {
            const fallback = await supabase
                .from('creator_favorites')
                .select('*')
                .eq('user_id', favUserId)
                .order('created_at', { ascending: false });
            data = fallback.data;
            error = fallback.error;
        }
        if (error) {
            console.error('Favorites fetch:', error);
            setFavorites([]);
        } else {
            setFavorites(data || []);
        }
    };

    const persistFramesnagListTarget = (listId) => {
        if (!listId) return;
        try {
            localStorage.setItem('screenmerch_framesnag_list_id', listId);
            localStorage.setItem('screenmerch_framesnag_origin', window.location.origin);
        } catch (_) {}
    };

    const selectedFavoritePage = favoritePages.find((p) => p.id === selectedFavoriteListId) || null;
    const pageVideosUserId = selectedFavoritePage?.is_collaborator_page
        ? (selectedFavoritePage.owner_user_id || null)
        : (user?.id || null);
    const pageVideos = umbrellaOnly
        ? videos
        : (pageVideosUserId && String(pageVideosUserId) === String(user?.id)
            ? videos
            : otherPageVideos);

    useEffect(() => {
        if (!pageVideosUserId || String(pageVideosUserId) === String(user?.id)) {
            setOtherPageVideos([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(
                    `${apiJoin('/api/videos')}?user_id=${encodeURIComponent(pageVideosUserId)}&limit=100`
                );
                const data = res.ok ? await res.json().catch(() => []) : [];
                if (!cancelled) setOtherPageVideos(Array.isArray(data) ? data : []);
            } catch (_) {
                if (!cancelled) setOtherPageVideos([]);
            }
        })();
        return () => { cancelled = true; };
    }, [pageVideosUserId, user?.id]);

    useEffect(() => {
        if (!demoPreview || !user?.id) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(
                    `${apiJoin('/api/videos')}?user_id=${encodeURIComponent(user.id)}&limit=100`
                );
                const data = res.ok ? await res.json().catch(() => []) : [];
                if (!cancelled) setVideos(Array.isArray(data) ? data : []);
            } catch (_) {
                if (!cancelled) setVideos([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [demoPreview, user?.id]);

    useEffect(() => {
        selectedFavoriteListIdRef.current = selectedFavoriteListId;
    }, [selectedFavoriteListId]);

    useEffect(() => {
        if (!user?.id || userProfile?.role !== 'creator') return;
        if (!demoPreview && activeTab !== 'favorites') return;
        let cancelled = false;
        (async () => {
            if (demoPreview) {
                const { ok, data } = await fetchPublicFavoriteLists(DEMO_STOREFRONT_SUBDOMAIN);
                if (cancelled) return;
                const lists = withCollaboratorPageFlags(data?.lists || [], user.id);
                if (ok && lists.length) {
                    setFavoritePages(lists);
                    const primary = lists.find((l) => l.is_primary)
                        || lists.find((l) => !l.is_collaborator_page)
                        || lists[0];
                    const prev = selectedFavoriteListIdRef.current;
                    const nextId =
                        prev && lists.some((l) => l.id === prev)
                            ? prev
                            : primary?.id || null;
                    setSelectedFavoriteListId(nextId);
                    if (nextId) {
                        const page = lists.find((l) => l.id === nextId);
                        await reloadFavoritesForList(page?.owner_user_id || user.id, nextId, lists);
                    }
                } else {
                    setFavoritePages([]);
                    setFavorites([]);
                }
                return;
            }
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/mine');
            if (cancelled) return;
            if (data?.is_umbrella_only) {
                setUmbrellaOnly(true);
                setUmbrellaOwnerName(data.owner_name || '');
            }
            if (data?.user_id && data.user_id !== user.id) {
                const merged = { ...user, id: data.user_id };
                localStorage.setItem('user', JSON.stringify(merged));
                setUser(merged);
            }
            const listUserId = data?.user_id || user.id;
            if (ok && data?.lists?.length) {
                setFavoritePages(data.lists);
                const ownerId = data.user_id || user.id;
                void linkOwnerExtraPagesToStorefront(ownerId, data.lists);
                const collabList = data.lists.find((l) => l.storefront_owner_id) || null;
                const primary = data.is_umbrella_only
                    ? collabList
                    : (data.lists.find((l) => l.is_primary) || data.lists.find((l) => !l.is_collaborator_page) || data.lists[0]);
                const urlListId = (searchParams.get('list_id') || '').trim();
                let storedListId = '';
                try {
                    storedListId = localStorage.getItem('screenmerch_framesnag_list_id') || '';
                } catch (_) {}
                const preferredListId = urlListId || storedListId;
                const prev = selectedFavoriteListIdRef.current;
                const nextId =
                    preferredListId && data.lists.some((l) => l.id === preferredListId)
                        ? preferredListId
                        : prev && data.lists.some((l) => l.id === prev && (!data.is_umbrella_only || l.storefront_owner_id))
                        ? prev
                        : primary?.id || null;
                setSelectedFavoriteListId(nextId);
                if (nextId) persistFramesnagListTarget(nextId);
                if (data.is_umbrella_only && primary) {
                    const rawName = (primary.display_name || '').replace(/\s*\(owner\)\s*/gi, ' ').trim();
                    setUmbrellaPageName(isUmbrellaAutoPageName(rawName) ? '' : cleanFavoritePageNickname(rawName));
                }
                if (nextId && listUserId) {
                    const page = data.lists.find((l) => l.id === nextId);
                    const favUserId = page?.is_collaborator_page ? page.owner_user_id : listUserId;
                    await reloadFavoritesForList(favUserId, nextId, data.lists);
                }
            } else {
                setFavoritePages([]);
                setFavorites([]);
            }
        })();
        return () => { cancelled = true; };
    }, [activeTab, user?.id, userProfile?.role, demoPreview]);

    const handleFavoriteListChange = (listId) => {
        if (!user?.id || !listId) return;
        setSelectedFavoriteListId(listId);
        persistFramesnagListTarget(listId);
        const page = favoritePages.find((p) => p.id === listId);
        const favUserId = page?.is_collaborator_page ? page.owner_user_id : user.id;
        reloadFavoritesForList(favUserId, listId);
    };

    const handleSaveUmbrellaPageName = async () => {
        if (demoPreview) return;
        const name = cleanFavoritePageNickname(umbrellaPageName);
        const selectedList = favoritePages.find((l) => String(l.id) === String(selectedFavoriteListId));
        const collabList = selectedList?.is_collaborator_page
            ? selectedList
            : (favoritePages.find((l) => l.is_collaborator_page) || favoritePages[0]);
        const listId = selectedList?.id || collabList?.id;
        if (!name) {
            alert('Enter a page name (this nickname appears in the storefront menu — not your email).');
            return;
        }
        if (favoritePageNameTaken(favoritePages, name, { ignoreListId: listId })) {
            alert('That page name is already in use. Choose a different nickname.');
            return;
        }
        setSavingFavoritePage(true);
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/rename', {
                method: 'POST',
                body: JSON.stringify({ list_id: listId, display_name: name }),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not save page name');
                return;
            }
            const updated = data.list;
            setFavoritePages((prev) =>
                prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            );
            setUmbrellaPageName(cleanFavoritePageNickname(updated.display_name || name));
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not save page name');
        } finally {
            setSavingFavoritePage(false);
        }
    };

    const handleCreateFavoritePage = async () => {
        if (demoPreview) return;
        const name = newPageName.trim();
        if (!name) {
            alert('Enter a display name for the new page.');
            return;
        }
        if (favoritePageNameTaken(favoritePages, name)) {
            alert('A page with this name already exists. Choose a different name.');
            return;
        }
        setSavingFavoritePage(true);
        try {
            const body = { display_name: name };
            const { ok, data } = await favoriteListsJson('/api/favorite-lists', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not create page');
                return;
            }
            const created = data.list;
            setFavoritePages((prev) => [...prev, created].sort((a, b) => {
                const ap = a.is_primary ? 0 : 1;
                const bp = b.is_primary ? 0 : 1;
                if (ap !== bp) return ap - bp;
                return (a.sort_order || 0) - (b.sort_order || 0);
            }));
            setNewPageName('');
            if (created?.id && user?.id) {
                void linkOwnerExtraPagesToStorefront(user.id, [
                    { ...created, owner_user_id: created.owner_user_id || user.id },
                ]);
                setSelectedFavoriteListId(created.id);
                await reloadFavoritesForList(user.id, created.id);
            }
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not create page');
        } finally {
            setSavingFavoritePage(false);
        }
    };

    const handleMoveFavoriteToList = async (favorite, targetListId) => {
        if (demoPreview) return;
        if (!user?.id || !targetListId) return;
        const cur = favorite.list_id != null ? String(favorite.list_id) : '';
        if (cur === String(targetListId)) return;
        setMovingFavoriteId(favorite.id);
        try {
            const { ok, data } = await favoriteListsJson('/api/favorites/move-list', {
                method: 'POST',
                body: JSON.stringify({ favorite_id: favorite.id, list_id: targetListId }),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not move item to that page');
                return;
            }
            if (String(targetListId) === String(selectedFavoriteListId)) {
                setFavorites((prev) =>
                    prev.map((f) => (f.id === favorite.id ? { ...f, list_id: targetListId } : f))
                );
            } else {
                setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
            }
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not move item');
        } finally {
            setMovingFavoriteId(null);
        }
    };

    const handleDeleteFavoritePage = async () => {
        if (demoPreview) return;
        const row = favoritePages.find((l) => l.id === selectedFavoriteListId);
        if (!row || row.is_primary) return;
        const n = favorites.length;
        const msg =
            n > 0
                ? `Delete page "${row.display_name}"? The ${n} item(s) on this page will move to your main page. This page’s public link will stop working.`
                : `Delete page "${row.display_name}"? This page’s public link will stop working.`;
        if (!window.confirm(msg)) {
            return;
        }
        setSavingFavoritePage(true);
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/delete', {
                method: 'POST',
                body: JSON.stringify({ id: row.id }),
            });
            if (!ok || !data?.success) {
                alert(data?.error || 'Could not delete page');
                return;
            }
            const nextLists = favoritePages.filter((l) => l.id !== row.id);
            setFavoritePages(nextLists);
            const fallback = nextLists.find((l) => l.is_primary) || nextLists[0];
            const nextId = fallback?.id || null;
            setSelectedFavoriteListId(nextId);
            if (nextId && user?.id) await reloadFavoritesForList(user.id, nextId);
            else setFavorites([]);
        } catch (e) {
            console.error(e);
            alert(e.message || 'Could not delete page');
        } finally {
            setSavingFavoritePage(false);
        }
    };

    useEffect(() => {
        const fetchCurrentUser = async () => {
            // Check for Google OAuth user first
            const isAuthenticated = localStorage.getItem('isAuthenticated');
            const userData = localStorage.getItem('user');
            
            if (isAuthenticated === 'true' && userData) {
                // Google OAuth user
                const googleUser = JSON.parse(userData);
                setCurrentUser({ ...googleUser, role: 'creator' });
            } else {
                // Fallback to Supabase auth
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', user.id)
                        .single();
                    setCurrentUser({ ...user, ...profile });
                } else {
                    setCurrentUser(null);
                }
            }
        };
        fetchCurrentUser();
    }, []);


    const handleDeleteVideo = async (videoId, videoTitle, event) => {
        event.stopPropagation();
        if (demoPreview) return;
        
        // Show confirmation dialog
        const isConfirmed = window.confirm(`Are you sure you want to delete "${videoTitle}"? This action cannot be undone.`);
        
        if (!isConfirmed) {
            return;
        }

        try {
            const result = await AdminService.deleteVideo(videoId);
            
            if (result.success) {
                // Remove the video from the local state
                setVideos(prevVideos => prevVideos.filter(video => video.id !== videoId));
                alert('Video deleted successfully!');
            } else {
                alert(`Failed to delete video: ${result.error}`);
            }
        } catch (error) {
            console.error('Error deleting video:', error);
            alert('Failed to delete video. Please try again.');
        }
    };

    const resetFavoriteModal = () => {
        setShowFavoriteModal(false);
        setEditingFavorite(null);
        setThumbnailTargetVideoId('');
        setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
    };

    const openFavoriteUploadModal = () => {
        if (demoPreview) return;
        setEditingFavorite(null);
        setThumbnailTargetVideoId('');
        setNewFavorite({ title: '', description: '', image: null, imagePreview: null });
        setShowFavoriteModal(true);
    };

    const ownVideosForThumbnail = videos.filter((v) => String(v.user_id || user?.id) === String(user?.id));

    const applyUploadedImageAsThumbnail = async (imageUrl) => {
        const videoId = thumbnailTargetVideoId;
        if (!videoId || !imageUrl) return '';
        try {
            const result = await AdminService.updateVideo(videoId, { thumbnail: imageUrl });
            if (result.success) {
                setVideos((prev) => prev.map((v) => (
                    String(v.id) === String(videoId) ? { ...v, thumbnail: imageUrl } : v
                )));
                return ' Thumbnail applied to the selected video.';
            }
        } catch (err) {
            console.error('Error applying video thumbnail:', err);
        }
        return ' Image saved, but the video thumbnail could not be updated.';
    };

    const openVideoForMerch = (video) => {
        const merchData = {
            thumbnail: video.thumbnail || video.thumbnail_url || '',
            screenshots: video.screenshots || [],
            videoUrl: video.video_url || '',
            videoTitle: video.title || 'Unknown Video',
            creatorName: userProfile?.display_name || userProfile?.username || 'Unknown Creator',
            videoId: video.id,
        };
        savePendingMerchData(merchData);
        localStorage.setItem('creator_favorites_mode', 'true');
        navigate('/product/browse?category=mens&creatorMode=favorites');
    };

    const handleEditFavorite = (favorite, event) => {
        event.stopPropagation();
        if (demoPreview) return;
        setEditingFavorite(favorite);
        setThumbnailTargetVideoId('');
        setNewFavorite({
            title: favorite.title || '',
            description: favorite.description || '',
            image: null,
            imagePreview: favorite.image_url || favorite.thumbnail_url || null
        });
        setShowFavoriteModal(true);
    };

    const getFavoriteAuthHeaders = async () => {
        let userId = user?.id || null;
        const isFlaskAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        const storedUserRaw = localStorage.getItem('user');
        let storedUser = null;
        if (storedUserRaw) {
            try {
                storedUser = JSON.parse(storedUserRaw);
            } catch (_) {
                storedUser = null;
            }
        }
        if (!userId && storedUser?.id) userId = storedUser.id;

        const { data: { user: supabaseUser }, error: authErr } = await supabase.auth.getUser();
        if (!userId && supabaseUser?.id) userId = supabaseUser.id;
        else if (!userId && storedUser?.email) {
            const { data: userRecord } = await supabase
                .from('users')
                .select('id')
                .eq('email', storedUser.email)
                .maybeSingle();
            if (userRecord?.id) userId = userRecord.id;
        }

        if (!userId) {
            console.error('Auth error:', authErr);
            return { error: 'Authentication required. Please sign in again from your invite link.' };
        }

        const useBackendUpload = isFlaskAuthenticated || !supabaseUser;
        const accountEmail = (user?.email || storedUser?.email || supabaseUser?.email || '').trim().toLowerCase();
        if (useBackendUpload && !accountEmail) {
            return { error: 'Your session is missing your email. Please sign out and sign in again with your invited email.' };
        }
        if (accountEmail && userId) {
            const synced = await fetchMyProfileFromBackend(userId);
            if (synced?.id && synced.id !== userId) {
                userId = synced.id;
                const merged = { ...(storedUser || user || {}), ...synced, id: synced.id };
                localStorage.setItem('user', JSON.stringify(merged));
                setUser(merged);
            }
        }

        let sessionToken = typeof localStorage !== 'undefined' && localStorage.getItem('auth_token');
        if (!sessionToken) sessionToken = await claimSessionTokenIfNeeded(userId);
        const headers = { 'X-User-Id': userId };
        if (accountEmail) headers['X-User-Email'] = accountEmail;
        if (sessionToken) headers['X-Session-Token'] = sessionToken;
        return { userId, accountEmail, sessionToken, useBackendUpload, supabaseUser, storedUser, headers };
    };

    const handleUpdateFavorite = async () => {
        if (!editingFavorite?.id) return;
        if (!newFavorite.title.trim()) {
            alert('Please provide a title.');
            return;
        }
        if (newFavorite.image && newFavorite.image.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB.');
            return;
        }

        const auth = await getFavoriteAuthHeaders();
        if (auth.error) {
            alert(auth.error);
            return;
        }

        try {
            setUploadingFavorite(true);
            const formData = new FormData();
            formData.append('favorite_id', editingFavorite.id);
            formData.append('title', newFavorite.title.trim());
            if (newFavorite.description) formData.append('description', newFavorite.description);
            formData.append('user_id', auth.userId);
            if (auth.accountEmail) formData.append('email', auth.accountEmail);
            if (auth.sessionToken) formData.append('session_token', auth.sessionToken);
            if (newFavorite.image) formData.append('file', newFavorite.image);

            const res = await fetch(`${getBackendUrl()}/api/favorites/update`, {
                method: 'POST',
                credentials: 'include',
                headers: auth.headers,
                body: formData
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                alert(json.error || `Update failed (${res.status})`);
                return;
            }
            if (json.favorite) {
                setFavorites(prev => prev.map(fav => fav.id === editingFavorite.id ? { ...fav, ...json.favorite } : fav));
            }
            const imageUrl = json.favorite?.image_url || json.favorite?.thumbnail_url || editingFavorite?.image_url;
            const extra = await applyUploadedImageAsThumbnail(imageUrl);
            resetFavoriteModal();
            alert('Image updated successfully!' + extra);
        } catch (error) {
            console.error('Error updating favorite:', error);
            alert(`Failed to update image: ${error.message || 'Unknown error'}`);
        } finally {
            setUploadingFavorite(false);
        }
    };

    const handleUploadFavorite = async () => {
        if (editingFavorite) {
            await handleUpdateFavorite();
            return;
        }
        if (!newFavorite.title || !newFavorite.image) {
            alert('Please provide a title and image.');
            return;
        }

        const auth = await getFavoriteAuthHeaders();
        if (auth.error) {
            alert(auth.error);
            return;
        }
        let userId = auth.userId;
        const { useBackendUpload, supabaseUser, storedUser, accountEmail, sessionToken, headers } = auth;

        try {
            setUploadingFavorite(true);

            // Validate file size (max 5MB)
            if (newFavorite.image.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB.');
                setUploadingFavorite(false);
                return;
            }

            if (useBackendUpload) {
                // Google OAuth: backend uploads to storage and inserts row (bypasses RLS)
                const channelTitle = userProfile?.display_name || userProfile?.username || 'Unknown';
                const formData = new FormData();
                formData.append('file', newFavorite.image);
                formData.append('user_id', userId);
                formData.append('title', newFavorite.title);
                if (newFavorite.description) formData.append('description', newFavorite.description);
                formData.append('channel_title', channelTitle);
                if (accountEmail) formData.append('email', accountEmail);
                if (selectedFavoriteListId) formData.append('list_id', selectedFavoriteListId);
                if (sessionToken) formData.append('session_token', sessionToken);
                const res = await fetch(`${getBackendUrl()}/api/favorites/upload`, {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: formData
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    alert(json.error || `Upload failed (${res.status})`);
                    setUploadingFavorite(false);
                    return;
                }
                if (json.success && json.favorite) {
                    if (json.user_id_corrected && json.user_id) {
                        const merged = { ...(storedUser || user || {}), id: json.user_id, email: accountEmail || (storedUser || user || {}).email };
                        localStorage.setItem('user', JSON.stringify(merged));
                        setUser(merged);
                    } else if (json.user_id && json.user_id !== userId && !json.collaborator_upload) {
                        const merged = { ...(storedUser || user || {}), id: json.user_id };
                        localStorage.setItem('user', JSON.stringify(merged));
                        setUser(merged);
                    }
                    setFavorites(prev => [json.favorite, ...prev]);
                    const extra = await applyUploadedImageAsThumbnail(json.favorite?.image_url || json.favorite?.thumbnail_url);
                    resetFavoriteModal();
                    alert('Favorite uploaded successfully!' + extra);
                } else {
                    alert(json.error || 'Upload failed');
                }
                setUploadingFavorite(false);
                return;
            }

            // Supabase Auth user: upload and insert via client
            const fileExt = newFavorite.image.name.split('.').pop();
            const fileName = `${userId}/favorites/${Date.now()}.${fileExt}`;
            
            console.log('Uploading favorite image:', fileName);
            console.log('User ID:', userId);
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('thumbnails')
                .upload(fileName, newFavorite.image, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                console.error('Error uploading image:', uploadError);
                console.error('Error details:', JSON.stringify(uploadError, null, 2));
                
                if (uploadError.message && uploadError.message.includes('not found')) {
                    alert('Storage bucket not found. Please check your Supabase storage configuration.');
                } else if (uploadError.message && uploadError.message.includes('row-level security')) {
                    alert('Permission denied. Please check your Supabase storage policies.');
                } else {
                    alert(`Failed to upload image: ${uploadError.message || 'Unknown error'}`);
                }
                setUploadingFavorite(false);
                return;
            }

            console.log('Image uploaded successfully:', uploadData);

            const { data: { publicUrl } } = supabase.storage
                .from('thumbnails')
                .getPublicUrl(fileName);

            console.log('Public URL:', publicUrl);

            const channelTitle = userProfile?.display_name || userProfile?.username || 'Unknown';
            console.log('Saving favorite to database with channelTitle:', channelTitle);

            let insertData = {
                user_id: userId,
                channelTitle: channelTitle,
                title: newFavorite.title,
                description: newFavorite.description || null,
                image_url: publicUrl,
                thumbnail_url: publicUrl,
                ...(selectedFavoriteListId ? { list_id: selectedFavoriteListId } : {}),
            };
            
            const { data, error } = await supabase
                .from('creator_favorites')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('Error saving favorite:', error);
                if (error.message && (error.message.includes('channelTitle') || error.message.includes('channeltitle'))) {
                    const retryData = {
                        user_id: userId,
                        channeltitle: channelTitle,
                        title: newFavorite.title,
                        description: newFavorite.description || null,
                        image_url: publicUrl,
                        thumbnail_url: publicUrl,
                        ...(selectedFavoriteListId ? { list_id: selectedFavoriteListId } : {}),
                    };
                    const { data: retryData_result, error: retryError } = await supabase
                        .from('creator_favorites')
                        .insert(retryData)
                        .select()
                        .single();
                    if (retryError) {
                        alert(`Failed to save favorite: ${retryError.message || 'Unknown error'}.`);
                    } else {
                        setFavorites(prev => [retryData_result, ...prev]);
                        const extra = await applyUploadedImageAsThumbnail(publicUrl);
                        resetFavoriteModal();
                        alert('Favorite uploaded successfully!' + extra);
                    }
                } else {
                    alert(`Failed to save favorite: ${error.message || 'Unknown error'}`);
                }
            } else {
                console.log('Favorite saved successfully:', data);
                setFavorites(prev => [data, ...prev]);
                const extra = await applyUploadedImageAsThumbnail(publicUrl);
                resetFavoriteModal();
                alert('Favorite uploaded successfully!' + extra);
            }
        } catch (error) {
            console.error('Error uploading favorite:', error);
            console.error('Error stack:', error.stack);
            alert(`Failed to upload favorite: ${error.message || 'Unknown error'}`);
        } finally {
            setUploadingFavorite(false);
        }
    };

    const handleMakeMerchFromFavorite = async (favorite) => {
        markMerchIntentStarted();
        // Check if user is authenticated
        const isAuthenticated = localStorage.getItem('user_authenticated');
        const googleAuthenticated = localStorage.getItem('isAuthenticated');
        const isLoggedIn = (isAuthenticated === 'true') || (googleAuthenticated === 'true');
        
        if (!isLoggedIn) {
            // Store favorite data for after login
            const merchData = {
                thumbnail: favorite.image_url || favorite.thumbnail_url,
                screenshots: [favorite.image_url || favorite.thumbnail_url],
                videoUrl: window.location.href,
                videoTitle: favorite.title || 'Favorite Image',
                creatorName: favorite.channeltitle || favorite.channelTitle || userProfile?.display_name || userProfile?.username || 'Unknown Creator'
            };
            savePendingMerchData(merchData);
            alert('Please log in to create merchandise');
            return;
        }
        
        // User is authenticated, save data and navigate to merchandise page
        const merchData = {
            thumbnail: favorite.image_url || favorite.thumbnail_url,
            screenshots: [favorite.image_url || favorite.thumbnail_url],
            videoUrl: window.location.href,
            videoTitle: favorite.title || 'Favorite Image',
            creatorName: favorite.channeltitle || favorite.channelTitle || userProfile?.display_name || userProfile?.username || 'Unknown Creator'
        };
        savePendingMerchData(merchData);
        
        // Navigate to merchandise categories page
        navigate('/merchandise');
        window.scrollTo(0, 0);
    };

    const handleDeleteFavorite = async (favoriteId, favoriteTitle) => {
        if (demoPreview) return;
        const isConfirmed = window.confirm(`Are you sure you want to delete "${favoriteTitle}"? This action cannot be undone.`);
        
        if (!isConfirmed) {
            return;
        }

        try {
            const { error } = await supabase
                .from('creator_favorites')
                .delete()
                .eq('id', favoriteId);

            if (error) {
                console.error('Error deleting favorite:', error);
                alert('Failed to delete favorite. Please try again.');
            } else {
                // Remove from local state
                setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
                alert('Favorite deleted successfully!');
            }
        } catch (error) {
            console.error('Error deleting favorite:', error);
            alert('Failed to delete favorite. Please try again.');
        }
    };

    const handleEditVideo = (video, event) => {
        event.stopPropagation();
        if (demoPreview) return;
        setEditingVideo(video);
        setEditVideoForm({
            title: video.title || '',
            thumbnail: video.thumbnail || '',
            video_url: video.video_url || ''
        });
        setThumbnailPreview(null);
    };

    // Reset scroll position when modal opens and ensure content is visible
    useEffect(() => {
        if (editingVideo && modalContentRef.current) {
            // Reset scroll to top
            modalContentRef.current.scrollTop = 0;
            // Force a reflow to ensure content is properly positioned
            modalContentRef.current.offsetHeight;
        }
    }, [editingVideo]);

    const handleCancelEdit = () => {
        setEditingVideo(null);
        setEditVideoForm({ title: '', thumbnail: '', video_url: '' });
        setThumbnailPreview(null);
    };

    const uploadThumbnailToSupabase = async (file) => {
        try {
            setUploadingThumbnail(true);
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/thumbnails/${Date.now()}.${fileExt}`;
            
            const { data, error } = await supabase.storage
                .from('thumbnails')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading thumbnail:', error);
                alert('Failed to upload thumbnail. Please try again.');
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('thumbnails')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Error in uploadThumbnailToSupabase:', error);
            alert('Failed to upload thumbnail. Please try again.');
            return null;
        } finally {
            setUploadingThumbnail(false);
        }
    };

    const uploadVideoToSupabase = async (file) => {
        try {
            setUploadingVideoFile(true);
            
            if (!user || !user.id) {
                alert('User not found. Please sign in again.');
                return null;
            }
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/videos/${Date.now()}.${fileExt}`;
            
            console.log('Attempting to upload video:', fileName);
            console.log('User ID:', user.id);
            
            const { data, error } = await supabase.storage
                .from('videos2')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading video:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                
                if (error.message && error.message.includes('row-level security')) {
                    alert('Upload failed: Permission denied. The storage policies may not allow uploads for your account. Please use the Video URL field instead, or ensure you are authenticated through Supabase Auth.');
                } else if (error.message && error.message.includes('new row violates')) {
                    alert('Upload failed: Storage policy error. Please check your Supabase storage policies or use the Video URL field instead.');
                } else {
                    alert(`Failed to upload video: ${error.message || 'Unknown error. Please try using the Video URL field instead.'}`);
                }
                return null;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('videos2')
                .getPublicUrl(fileName);

            console.log('Video uploaded successfully:', publicUrl);
            return publicUrl;
        } catch (error) {
            console.error('Error in uploadVideoToSupabase:', error);
            console.error('Error stack:', error.stack);
            alert(`Failed to upload video: ${error.message || 'Please try again or use the Video URL field instead.'}`);
            return null;
        } finally {
            setUploadingVideoFile(false);
        }
    };

    const handleThumbnailChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB.');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setThumbnailPreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // Upload to Supabase
        const thumbnailUrl = await uploadThumbnailToSupabase(file);
        if (thumbnailUrl) {
            setEditVideoForm(prev => ({ ...prev, thumbnail: thumbnailUrl }));
        }
    };

    const handleVideoFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            alert('Please select a valid video file.');
            return;
        }

        // Upload to Supabase
        const videoUrl = await uploadVideoToSupabase(file);
        if (videoUrl) {
            setEditVideoForm(prev => ({ ...prev, video_url: videoUrl }));
        }
    };

    const handleSaveVideo = async () => {
        if (!editingVideo) return;

        try {
            const updates = {};
            if (editVideoForm.title.trim()) {
                updates.title = editVideoForm.title.trim();
            }
            if (editVideoForm.thumbnail) {
                updates.thumbnail = editVideoForm.thumbnail;
            }
            if (editVideoForm.video_url) {
                updates.video_url = editVideoForm.video_url;
            }

            if (Object.keys(updates).length === 0) {
                alert('No changes to save.');
                return;
            }

            const result = await AdminService.updateVideo(editingVideo.id, updates);
            
            if (result.success) {
                // Update the video in the local state
                setVideos(prevVideos => 
                    prevVideos.map(video => 
                        video.id === editingVideo.id 
                            ? { ...video, ...updates }
                            : video
                    )
                );
                if (updates.video_url) {
                    requestVideoOptimize({
                        videoId: editingVideo.id,
                        videoUrl: updates.video_url,
                    });
                }
                alert('Video updated successfully!');
                handleCancelEdit();
            } else {
                alert(`Failed to update video: ${result.error}`);
            }
        } catch (error) {
            console.error('Error updating video:', error);
            alert('Failed to update video. Please try again.');
        }
    };

    // Check if current user is master admin (so we only show Reset Sales to them)
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!user?.email) return;
            try {
                const status = await AdminService.checkAdminStatus();
                if (mounted) setIsMasterAdmin(status?.isMasterAdmin || false);
            } catch (_) {
                if (mounted) setIsMasterAdmin(false);
            }
        })();
        return () => { mounted = false; };
    }, [user?.email]);

    const mergeCollabPayoutRows = (rows) => {
        const recorded = recordedCollabPayoutsRef.current;
        return (rows || []).map((row) => {
            const id = String(row.favorite_list_id || '');
            const rec = recorded[id];
            if (!rec) return row;
            const serverPaid = Number(row.paid_total || 0);
            if (serverPaid + 0.009 >= rec.paid_total) {
                delete recorded[id];
                return row;
            }
            const lifetime = Number(row.pay_collaborator_amount || 0);
            const nextBalance = Math.max(0, lifetime - rec.paid_total);
            return {
                ...row,
                paid_total: rec.paid_total,
                balance_owed: nextBalance,
                is_paid_up: lifetime > 0 && nextBalance <= 0.009,
                can_record_payout: nextBalance >= 50,
                last_payout: newestPayout([rec.payout, row.last_payout, ...(row.recent_payouts || [])]),
            };
        });
    };

    // Fetch analytics data (owner: all sales; umbrella collaborator: their page only)
    const fetchAnalytics = async () => {
        if (!user || !user.id) {
            console.warn('Cannot fetch analytics: user not found');
            return;
        }
        const gen = ++analyticsFetchGenRef.current;

        setAnalyticsLoading(true);
        setAnalyticsError('');
        try {
            let data;
            if (umbrellaOnly) {
                const { ok, data: payload } = await favoriteListsJson('/api/favorite-lists/my-analytics');
                if (!ok) {
                    throw new Error(payload?.error || 'Could not load page analytics');
                }
                data = payload;
            } else {
                const BACKEND_URL = getBackendUrl();
                if (demoPreview) {
                    const response = await fetch(`${BACKEND_URL}/api/demo/analytics`, {
                        method: 'GET',
                        headers: { Accept: 'application/json' },
                    });
                    if (!response.ok) {
                        throw new Error(`Analytics API error: ${response.status}`);
                    }
                    data = await response.json();
                } else {
                const email = (user?.email || userProfile?.email || '').trim().toLowerCase();
                const headers = {
                    Accept: 'application/json',
                    'Cache-Control': 'no-cache',
                };
                if (isMasterAdmin && email) {
                    headers['X-User-Email'] = email;
                }
                const qs = isMasterAdmin
                    ? 'scope=all'
                    : `user_id=${encodeURIComponent(user.id)}`;
                const response = await fetch(`${BACKEND_URL}/api/analytics?${qs}`, {
                    method: 'GET',
                    headers,
                });

                if (!response.ok) {
                    throw new Error(`Analytics API error: ${response.status}`);
                }

                data = await response.json();
                }
            }

            console.log('📊 Analytics data received:', data);
            if (gen !== analyticsFetchGenRef.current) return;

            setAnalyticsData({
                total_sales: data.total_sales || 0,
                total_revenue: data.total_revenue || 0,
                avg_order_value: data.avg_order_value || 0,
                products_sold_count: data.products_sold_count || 0,
                videos_with_sales_count: data.videos_with_sales_count || 0,
                week_sales_count: data.week_sales_count,
                sales_data: data.sales_data || [],
                products_sold: data.products_sold || [],
                videos_with_sales: data.videos_with_sales || [],
                recent_sales: data.recent_sales || [],
                daily_sales: data.daily_sales || [],
                page_name: data.page_name || '',
                storefront_owner_name: data.storefront_owner_name || '',
                collaborator_net_owed: data.collaborator_net_owed || 0,
                paid_total: data.paid_total || 0,
                last_payout: newestPayout([data.last_payout, ...(data.recent_payouts || [])]),
                recent_payouts: data.recent_payouts || [],
                payout_note: data.payout_note || '',
                payout_summary: data.payout_summary || {},
                platform_fee_amount: data.platform_fee_amount ?? data.payout_summary?.platform_fee_amount ?? 0,
                pay_collaborator_amount: data.pay_collaborator_amount ?? data.payout_summary?.collaborator_pay_total ?? 0,
                owner_fee_amount: data.owner_fee_amount ?? data.payout_summary?.owner_fee_amount ?? 0,
                owner_fee_per_item: data.owner_fee_per_item ?? data.payout_summary?.owner_fee_per_item ?? 0,
                collaborator_share_before_fee:
                    data.collaborator_share_before_fee
                    ?? data.payout_summary?.collaborator_share_before_fee
                    ?? 0,
                fee_sales: data.fee_sales || [],
                is_paid_up: Boolean(data.is_paid_up),
                owner_fee_type: data.owner_fee_type || 'none',
                owner_fee_value: data.owner_fee_value ?? 0,
            });
            if (data.payout_summary?.screenmerch_pending_amount != null) {
                setScreenmerchPendingAmount(Number(data.payout_summary.screenmerch_pending_amount || 0));
            }
            if (data.payout_summary?.next_payout_date) {
                setNextPayoutDate(data.payout_summary.next_payout_date);
            }

            if (!umbrellaOnly) {
                try {
                    let sumOk = false;
                    let sumData = {};
                    if (demoPreview) {
                        const sumRes = await fetch(`${getBackendUrl()}/api/demo/sales-summary`, {
                            method: 'GET',
                            headers: { Accept: 'application/json' },
                        });
                        sumData = await sumRes.json().catch(() => ({}));
                        sumOk = sumRes.ok && sumData?.success !== false;
                    } else {
                        const sum = await favoriteListsJson('/api/favorite-lists/sales-summary');
                        sumOk = sum.ok;
                        sumData = sum.data;
                    }
                    if (sumOk) {
                        if (gen !== analyticsFetchGenRef.current) return;
                        const collabRows = (sumData?.by_list || []).filter((r) => r.is_collaborator_page);
                        setCollaboratorPayoutRows(mergeCollabPayoutRows(collabRows.map((row) => ({
                            ...row,
                            last_payout: newestPayout([row.last_payout, ...(row.recent_payouts || [])]),
                        }))));
                        setCollaboratorOwedTotal(Number(sumData?.collaborator_owed_total || 0));
                        setOwnerPayoutRows(sumData?.owner_pages || []);
                        setOwnerRecentSales(sumData?.owner_recent_sales || []);
                        setOwnerEarningsSummary(sumData?.storefront_owner_summary || null);
                        setScreenmerchPayouts(sumData?.screenmerch_payouts || []);
                        setScreenmerchPaidTotal(Number(sumData?.screenmerch_paid_total || 0));
                        if (sumData?.screenmerch_pending_amount != null) {
                            setScreenmerchPendingAmount(Number(sumData.screenmerch_pending_amount || 0));
                        }
                        if (sumData?.next_payout_date) {
                            setNextPayoutDate(sumData.next_payout_date);
                        }
                        const drafts = {};
                        collabRows.forEach((r) => {
                            const id = String(r.favorite_list_id);
                            const feeType = r.owner_fee_type || 'none';
                            const feeVal = r.owner_fee_value ?? 0;
                            drafts[id] = {
                                feeType,
                                feeValue: feeType === 'none' ? '' : String(feeVal),
                            };
                        });
                        setCollabFeeDrafts(drafts);
                    }
                } catch (_) {
                    /* non-fatal */
                }
            } else {
                setCollaboratorPayoutRows([]);
                setCollaboratorOwedTotal(0);
                setOwnerPayoutRows([]);
                setOwnerRecentSales([]);
                setOwnerEarningsSummary(null);
                setScreenmerchPayouts([]);
                setScreenmerchPaidTotal(0);
                setScreenmerchPendingAmount(0);
                setNextPayoutDate('');
                setCollabFeeDrafts({});
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setAnalyticsError(error?.message || 'Could not load sales analytics');
        } finally {
            if (gen === analyticsFetchGenRef.current) {
                setAnalyticsLoading(false);
            }
        }
    };

    const saveCollabFee = async (e, row) => {
        e.preventDefault();
        const listId = String(row.favorite_list_id);
        const draft = collabFeeDrafts[listId] || { feeType: 'none', feeValue: '' };
        setSavingCollabFeeId(listId);
        setCollabFeeMessages((prev) => ({ ...prev, [listId]: '' }));
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/owner-fee', {
                method: 'POST',
                body: JSON.stringify({
                    favorite_list_id: listId,
                    fee_type: draft.feeType,
                    fee_value: draft.feeType === 'none' ? 0 : Number(draft.feeValue) || 0,
                }),
            });
            if (!ok) {
                setCollabFeeMessages((prev) => ({
                    ...prev,
                    [listId]: data?.error || 'Could not save owner fee',
                }));
                return;
            }
            setCollabFeeMessages((prev) => ({
                ...prev,
                [listId]: 'Saved. This creator\'s pay now uses this rate.',
            }));
            await fetchAnalytics();
        } catch (err) {
            setCollabFeeMessages((prev) => ({
                ...prev,
                [listId]: err.message || 'Network error',
            }));
        } finally {
            setSavingCollabFeeId(null);
        }
    };

    const updateCollabFeeDraft = (listId, patch) => {
        const id = String(listId);
        setCollabFeeDrafts((prev) => ({
            ...prev,
            [id]: { ...(prev[id] || { feeType: 'none', feeValue: '' }), ...patch },
        }));
        setCollabFeeMessages((prev) => ({ ...prev, [id]: '' }));
    };

    const openAnalyticsPayoutModal = (row) => {
        const balance = Number(row.balance_owed ?? 0);
        analyticsPayoutIgnoreBackdropUntilRef.current = Date.now() + 500;
        setAnalyticsPayoutModal(row);
        setAnalyticsPayoutAmount(balance > 0 ? balance.toFixed(2) : '');
        setAnalyticsPayoutDate(todayPayoutInputDate());
        setAnalyticsPayoutNote('');
        setAnalyticsPayoutError('');
    };

    const closeAnalyticsPayoutModal = (force = false) => {
        if (recordingAnalyticsPayout) return;
        if (!force && Date.now() < analyticsPayoutIgnoreBackdropUntilRef.current) return;
        setAnalyticsPayoutModal(null);
        setAnalyticsPayoutError('');
    };

    const applyRecordedCollaboratorPayout = (listId, payout, amount) => {
        const id = String(listId || '');
        const paidAmount = Number(amount || 0);
        setCollaboratorPayoutRows((prev) =>
            prev.map((row) => {
                if (String(row.favorite_list_id) !== id) return row;
                const nextPaid = Number(row.paid_total || 0) + paidAmount;
                const nextBalance = Math.max(0, Number(row.balance_owed || 0) - paidAmount);
                recordedCollabPayoutsRef.current[id] = {
                    amount: paidAmount,
                    paid_total: nextPaid,
                    payout: payout || row.last_payout,
                };
                return {
                    ...row,
                    paid_total: nextPaid,
                    balance_owed: nextBalance,
                    is_paid_up: nextBalance <= 0.009,
                    can_record_payout: nextBalance >= 50,
                    last_payout: newestPayout([payout, row.last_payout, ...(row.recent_payouts || [])]),
                    recent_payouts: [payout, ...(row.recent_payouts || [])].filter(Boolean).slice(0, 5),
                };
            })
        );
    };

    const submitAnalyticsPayout = async (e) => {
        e.preventDefault();
        const listId = analyticsPayoutModal?.favorite_list_id
            ? String(analyticsPayoutModal.favorite_list_id)
            : '';
        if (!listId) {
            setAnalyticsPayoutError('This collaborator page is missing an ID, so the payment cannot be saved. Refresh and try again.');
            return;
        }
        const amount = Number(analyticsPayoutAmount);
        if (!amount || amount <= 0) {
            setAnalyticsPayoutError('Enter a payment amount greater than zero.');
            return;
        }
        if (amount < 50) {
            setAnalyticsPayoutError('Minimum collaborator payout is $50.');
            return;
        }
        setRecordingAnalyticsPayout(true);
        setAnalyticsPayoutError('');
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/record-collaborator-payout', {
                method: 'POST',
                body: JSON.stringify({
                    favorite_list_id: listId,
                    display_name: analyticsPayoutModal.display_name || undefined,
                    amount,
                    paid_at: analyticsPayoutDate,
                    note: analyticsPayoutNote.trim() || undefined,
                }),
            });
            if (!ok) {
                setAnalyticsPayoutError(data?.error || 'Could not record payment');
                return;
            }
            applyRecordedCollaboratorPayout(listId, data?.payout, amount);
            setAnalyticsPayoutModal(null);
            await fetchAnalytics();
        } catch (err) {
            setAnalyticsPayoutError(err.message || 'Network error');
        } finally {
            setRecordingAnalyticsPayout(false);
        }
    };

    const submitConfirmCollabReceipt = async () => {
        const payoutId = analyticsData.last_payout?.id
            ? String(analyticsData.last_payout.id)
            : '';
        setConfirmingCollabReceipt(true);
        setCollabReceiptError('');
        try {
            const { ok, data } = await favoriteListsJson('/api/favorite-lists/confirm-collaborator-payout', {
                method: 'POST',
                body: JSON.stringify(payoutId ? { payout_id: payoutId } : {}),
            });
            if (!ok) {
                setCollabReceiptError(data?.error || 'Could not confirm receipt');
                return;
            }
            const confirmed = data?.payout;
            if (confirmed) {
                setAnalyticsData((prev) => ({
                    ...prev,
                    last_payout: newestPayout([confirmed, prev.last_payout, ...(prev.recent_payouts || [])]),
                    recent_payouts: [confirmed, ...(prev.recent_payouts || []).filter((p) => String(p?.id || '') !== String(confirmed.id || ''))].slice(0, 5),
                }));
            }
            await fetchAnalytics();
        } catch (err) {
            setCollabReceiptError(err.message || 'Network error');
        } finally {
            setConfirmingCollabReceipt(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'analytics' || !user?.id) return;
        if (!demoPreview && !umbrellaStatusReady) return;
        fetchAnalytics();
    }, [activeTab, umbrellaOnly, umbrellaStatusReady, user?.id, isMasterAdmin, demoPreview]);



    if (!demoPreview && isDemoStorefront() && creatorLoading) {
        return <div className="dashboard-loading">Loading your dashboard...</div>;
    }

    if (!demoPreview && isDemoStorefrontVisitor(currentCreator?.id)) {
        return <Navigate to={DEMO_DASHBOARD_PATH} replace />;
    }

    // Check if user has proper role or needs to be created/updated
    if (!demoPreview && currentUser && (!currentUser.role || currentUser.role !== 'creator')) {
        console.log('User role issue:', currentUser.role, 'User:', currentUser);
        return <div className="dashboard-error">
            Access denied. Only creators can view this page.
            <br />
            <button onClick={async () => {
                try {
                    console.log('Fixing role for user:', currentUser.id);
                    
                    // First check if user exists in users table
                    const { data: existingUser, error: checkError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', currentUser.id)
                        .single();
                    
                    if (checkError && checkError.code === 'PGRST116') {
                        // User doesn't exist, create them
                        console.log('User not found, creating new user record');
                        const { data: newUser, error: createError } = await supabase
                            .from('users')
                            .upsert({
                                id: currentUser.id,
                                email: currentUser.email,
                                username: currentUser.email?.split('@')[0] || 'user',
                                display_name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
                                role: 'creator',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'id',
                                ignoreDuplicates: false
                            })
                            .select();
                        
                        if (createError) {
                            console.error('Error creating user:', createError);
                            // If it's a duplicate key error, try to update instead
                            if (createError.message.includes('duplicate key')) {
                                console.log('Duplicate key detected, updating existing user');
                                const { data: updatedUser, error: updateError } = await supabase
                                    .from('users')
                                    .update({
                                        role: 'creator',
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', currentUser.id)
                                    .select();
                                
                                if (updateError) {
                                    console.error('Error updating user:', updateError);
                                    alert('Failed to update user: ' + updateError.message);
                                } else {
                                    console.log('User updated successfully:', updatedUser);
                                    alert('User updated! Reloading page...');
                                    window.location.reload();
                                }
                            } else {
                                alert('Failed to create user: ' + createError.message);
                            }
                        } else {
                            console.log('User created successfully:', newUser);
                            alert('User created! Reloading page...');
                            window.location.reload();
                        }
                    } else if (existingUser) {
                        // User exists, update their role
                        const { data, error } = await supabase
                            .from('users')
                            .update({ role: 'creator' })
                            .eq('id', currentUser.id)
                            .select();
                        
                        if (error) {
                            console.error('Error updating role:', error);
                            alert('Failed to update role: ' + error.message);
                        } else {
                            console.log('Role updated successfully:', data);
                            alert('Role updated! Reloading page...');
                            window.location.reload();
                        }
                    } else {
                        console.error('Unexpected error checking user:', checkError);
                        alert('Error checking user: ' + checkError.message);
                    }
                } catch (err) {
                    console.error('Error in role fix:', err);
                    alert('Error fixing role: ' + err.message);
                }
            }} style={{marginTop: '10px', padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
                Fix Role & Reload
            </button>
        </div>;
    }

    if (loading) {
        return <div className="dashboard-loading">Loading your dashboard...</div>;
    }

    if (!user) {
        if (demoPreview) {
            return <div className="dashboard-loading">Loading your dashboard...</div>;
        }
        return <div className="dashboard-error">Please log in to see your dashboard.</div>;
    }

    return (
        <div className={`dashboard-container ${sidebar ? "" : " large-container"}`}>
            {/* Tab Navigation */}
            <div className="dashboard-tabs">
                <button 
                    className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('favorites');
                    }}
                >
                    {umbrellaOnly ? 'Pages' : `⭐ Pages (${favoritePages.length})`}
                </button>
                <button
                    className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    📊 Analytics
                </button>
                {!umbrellaOnly && (
                <>
                <button 
                    className={`tab-button ${activeTab === 'payout' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payout')}
                >
                    💰 Payout Setup
                </button>
                <button 
                    className={`tab-button ${activeTab === 'personalization' ? 'active' : ''}`}
                    onClick={() => setActiveTab('personalization')}
                >
                    🎨 Personalization
                </button>
                {userProfile?.role === 'creator' && (
                    <button
                        className={`tab-button ${activeTab === 'umbrella' ? 'active' : ''}`}
                        onClick={() => setActiveTab('umbrella')}
                    >
                        ☂️ Umbrella
                    </button>
                )}
                </>
                )}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {/* Pages Tab */}
                {activeTab === 'favorites' && (
                    <div className="favorites-tab">
                        {!umbrellaOnly && (
                        <p className="paste-hint">
                            Paste from <a href="#framesnag-instructions">FrameSnag</a> (Ctrl+V) to add a captured image. Uploads go to the page selected below
                            {favoritePages.some((p) => p.is_collaborator_page) ? ' — including umbrella collaborator pages.' : '.'}
                        </p>
                        )}
                        <div className={`favorites-tab-controls${umbrellaOnly ? ' favorites-tab-controls--umbrella' : ''}`}>
                        {userProfile?.role === 'creator' && umbrellaOnly && favoritePages.length > 0 && (
                            <div className="umbrella-fav-page-bar">
                                <div className="umbrella-fav-page-intro">
                                    <p>
                                        Choose a <strong>nickname</strong> for your page — customers see this in the
                                        Pages menu, not your email.
                                    </p>
                                </div>
                                <div className="umbrella-fav-page-row">
                                    <input
                                        id="umbrella-page-name"
                                        type="text"
                                        className="favorite-pages-input umbrella-page-name-input"
                                        placeholder="Page Name"
                                        value={umbrellaPageName}
                                        onChange={(e) => setUmbrellaPageName(e.target.value)}
                                        aria-label="Page Name"
                                    />
                                    <button
                                        type="button"
                                        className="save-btn"
                                        disabled={savingFavoritePage || !umbrellaPageName.trim()}
                                        onClick={handleSaveUmbrellaPageName}
                                    >
                                        {savingFavoritePage ? 'Saving…' : 'Save name'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {userProfile?.role === 'creator' && !umbrellaOnly && favoritePages.length > 0 && (
                            <div className="favorite-pages-toolbar">
                                <div className="favorite-pages-row favorite-pages-row--main">
                                    <label className="favorite-pages-gutter" htmlFor="dashboard-fav-list-select">Choose Page</label>
                                    <select
                                        id="dashboard-fav-list-select"
                                        className="favorite-pages-select favorite-pages-ctrl"
                                        value={selectedFavoriteListId || ''}
                                        onChange={(e) => handleFavoriteListChange(e.target.value)}
                                    >
                                        {favoritePages.some((p) => !p.is_collaborator_page) && (
                                            <optgroup label="Your pages">
                                                {favoritePages.filter((p) => !p.is_collaborator_page).map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {favoritePageSelectLabel(p)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {favoritePages.some((p) => p.is_collaborator_page) && (
                                            <optgroup label="Umbrella collaborators">
                                                {favoritePages.filter((p) => p.is_collaborator_page).map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {favoritePageSelectLabel(p)}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="New page name"
                                        value={newPageName}
                                        onChange={(e) => setNewPageName(e.target.value)}
                                        className="favorite-pages-input favorite-pages-input--name favorite-pages-ctrl"
                                        disabled={demoPreview}
                                    />
                                    <button
                                        type="button"
                                        className="save-btn"
                                        disabled={demoPreview || savingFavoritePage || !newPageName.trim()}
                                        onClick={handleCreateFavoritePage}
                                    >
                                        {savingFavoritePage ? '…' : 'Create page'}
                                    </button>
                                    <button
                                        type="button"
                                        className="add-favorite-btn favorites-upload-btn favorite-pages-ctrl"
                                        onClick={() => navigate('/upload')}
                                        disabled={demoPreview}
                                    >
                                        Video Upload
                                    </button>
                                    <button
                                        type="button"
                                        className="add-favorite-btn favorites-upload-btn favorite-pages-ctrl"
                                        onClick={openFavoriteUploadModal}
                                        disabled={demoPreview}
                                    >
                                        Image Upload
                                    </button>
                                    {favoritePages.find((l) => l.id === selectedFavoriteListId)?.is_primary === false
                                        && !favoritePages.find((l) => l.id === selectedFavoriteListId)?.is_collaborator_page && (
                                        <button
                                            type="button"
                                            className="cancel-btn favorite-page-delete"
                                            disabled={demoPreview || savingFavoritePage}
                                            onClick={handleDeleteFavoritePage}
                                        >
                                            Delete page
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        </div>
                        {umbrellaOnly && (
                            <div className="umbrella-fav-under-actions umbrella-fav-under-actions--below-bar">
                                <button
                                    type="button"
                                    className="add-favorite-btn favorites-upload-btn"
                                    onClick={() => navigate('/upload')}
                                >
                                    Upload video
                                </button>
                                <button
                                    type="button"
                                    className="add-favorite-btn favorites-upload-btn"
                                    onClick={openFavoriteUploadModal}
                                >
                                    Upload image
                                </button>
                            </div>
                        )}

                        {/* Prominent hint when sent from FrameSnag */}
                        {!umbrellaOnly && showPasteHint && (
                            <div className="framesnag-paste-banner">
                                <span>📋 You were sent here from FrameSnag. <strong>Press Ctrl+V</strong> (or Cmd+V on Mac) to add your screenshot to your page.</span>
                                <button type="button" className="framesnag-paste-banner-dismiss" onClick={() => setShowPasteHint(false)} aria-label="Dismiss">×</button>
                            </div>
                        )}

                        <section className="page-media-section" aria-label="Videos on this page">
                            <h3>Videos ({pageVideos.length})</h3>
                            {pageVideos.length > 0 ? (
                                <div className="page-media-scroller">
                                    {pageVideos.map((video) => {
                                        const canManage = !demoPreview && String(video.user_id || '') === String(user?.id || '');
                                        return (
                                            <div
                                                key={video.id}
                                                className="dashboard-video-card"
                                                onClick={() => {
                                                    if (canManage) openVideoForMerch(video);
                                                    else navigate(`/video/${video.categoryId || 0}/${video.id}`);
                                                }}
                                            >
                                                <span className="page-item-badge">Video</span>
                                                <img
                                                    src={video.thumbnail || video.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}
                                                    alt={video.title}
                                                    className="dashboard-video-thumbnail"
                                                />
                                                <div className="dashboard-video-info">
                                                    <h4>{video.title}</h4>
                                                    <span className="video-views">{video.created_at ? new Date(video.created_at).toLocaleDateString() : ''}</span>
                                                </div>
                                                {canManage ? (
                                                    <>
                                                        <button className="edit-video-btn" onClick={(e) => handleEditVideo(video, e)} title="Edit Video">
                                                            ✏️
                                                        </button>
                                                        <button className="delete-video-btn" onClick={(e) => handleDeleteVideo(video.id, video.title, e)} title="Delete Video">
                                                            🗑️
                                                        </button>
                                                    </>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="page-media-empty">
                                    No videos on this page yet.{' '}
                                    <button
                                        type="button"
                                        className="page-media-empty-action"
                                        onClick={() => navigate('/upload')}
                                        disabled={demoPreview}
                                    >
                                        Upload a video
                                    </button>
                                </p>
                            )}
                        </section>

                        <section className="page-media-section" aria-label="Images on this page">
                            <h3>Images ({favorites.length})</h3>
                            {favorites.length > 0 ? (
                                <div className="page-media-scroller">
                                    {favorites.map((favorite) => (
                                        <div
                                            key={favorite.id}
                                            className="dashboard-video-card"
                                        >
                                            <span className="page-item-badge page-item-badge--image">Image</span>
                                            <img
                                                src={favorite.image_url || favorite.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Image'}
                                                alt={favorite.title}
                                                className="dashboard-video-thumbnail"
                                            />
                                            <div className="dashboard-video-info">
                                                <h4>{favorite.title}</h4>
                                                {favorite.description && <p>{favorite.description}</p>}
                                                <span className="video-views">{new Date(favorite.created_at).toLocaleDateString()}</span>
                                            </div>
                                            {userProfile?.role === 'creator' && !umbrellaOnly && favoritePages.length > 1 && (
                                                <div className="favorite-card-page-row">
                                                    <label htmlFor={`fav-list-${favorite.id}`}>Page</label>
                                                    <select
                                                        id={`fav-list-${favorite.id}`}
                                                        className="favorite-card-list-select"
                                                        value={String(favorite.list_id || selectedFavoriteListId || favoritePages[0]?.id || '')}
                                                        disabled={demoPreview || movingFavoriteId === favorite.id || savingFavoritePage}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            handleMoveFavoriteToList(favorite, v);
                                                        }}
                                                    >
                                                        {favoritePages.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {favoritePageSelectLabel(p)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <button
                                                className="make-merch-btn-favorite-dashboard"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMakeMerchFromFavorite(favorite);
                                                }}
                                            >
                                                Make Merch
                                            </button>
                                            <button
                                                className="edit-video-btn"
                                                onClick={(e) => handleEditFavorite(favorite, e)}
                                                title="Edit Image"
                                                disabled={demoPreview}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="delete-video-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFavorite(favorite.id, favorite.title);
                                                }}
                                                title="Delete Favorite"
                                                disabled={demoPreview}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="page-media-empty">
                                    No images on this page yet.{' '}
                                    <button
                                        type="button"
                                        className="page-media-empty-action"
                                        onClick={openFavoriteUploadModal}
                                        disabled={demoPreview}
                                    >
                                        Upload an image
                                    </button>
                                </p>
                            )}
                        </section>

                        {/* FrameSnag — storefront owners only */}
                        {!umbrellaOnly && (
                        <div className="framesnag-promo-section" id="framesnag-instructions">
                            <div className="framesnag-promo-content">
                                <div className="framesnag-promo-text">
                                    <h3>📸 Capture YouTube Screenshots with FrameSnag</h3>
                                    <p>Capture high-quality thumbnails and screenshots from your YouTube videos, then add them to your page!</p>
                                    <div className="framesnag-instructions">
                                        <p><strong>How to install (desktop only):</strong></p>
                                        <ol>
                                            <li>Click &quot;Install FrameSnag&quot; below to open the Chrome Web Store</li>
                                            <li>Click Add to Chrome</li>
                                            <li>Open one of your YouTube videos and click the FrameSnag icon to capture</li>
                                            <li>Send captures to your ScreenMerch page (or paste with Ctrl+V on Pages)</li>
                                        </ol>
                                    </div>
                                    <div className="framesnag-promo-code">
                                        <span className="promo-label">Your Free Pro Access Code:</span>
                                        <code className="promo-code">SCREENMERCH</code>
                                    </div>
                                </div>
                                <a
                                    href="https://chromewebstore.google.com/detail/framesnag-for-screenmerch/hfokckkkdojjgfgknpakccbfmbakkilf"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="framesnag-btn"
                                >
                                    Install FrameSnag →
                                </a>
                            </div>
                        </div>
                        )}
                        
                        {/* Favorite Upload Modal — portaled so sticky navbar cannot cover it */}
                        {showFavoriteModal && createPortal(
                            <div className="favorite-modal-overlay" onClick={resetFavoriteModal}>
                                <div className="favorite-modal-content" onClick={(e) => e.stopPropagation()} ref={modalContentRef}>
                                    <span className="favorite-modal-close" onClick={resetFavoriteModal}>&times;</span>
                                    <h2>{editingFavorite ? 'Edit Image' : 'Upload Image'}</h2>
                                <div className="upload-form">
                                    <p className="edit-video-tip">
                                        Add page artwork, or upload a catchy thumbnail you created and apply it to a video below.
                                    </p>
                                    <div className="form-group">
                                        <label>Title *</label>
                                        <input
                                            type="text"
                                            value={newFavorite.title}
                                            onChange={(e) => setNewFavorite({...newFavorite, title: e.target.value})}
                                            placeholder="Enter favorite title"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            value={newFavorite.description}
                                            onChange={(e) => setNewFavorite({...newFavorite, description: e.target.value})}
                                            placeholder="Enter description (optional)"
                                            rows="3"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>{editingFavorite ? 'Image' : 'Image *'}</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        setNewFavorite({
                                                            ...newFavorite,
                                                            image: file,
                                                            imagePreview: event.target.result
                                                        });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                        {editingFavorite && !newFavorite.image && (
                                            <p className="edit-video-tip">Choose a new file only if you want to replace the current image.</p>
                                        )}
                                        {newFavorite.imagePreview && (
                                            <img 
                                                src={newFavorite.imagePreview} 
                                                alt="Preview" 
                                                className="favorite-upload-preview"
                                            />
                                        )}
                                    </div>
                                    {ownVideosForThumbnail.length > 0 ? (
                                        <div className="form-group">
                                            <label htmlFor="favorite-thumb-video">Use as video thumbnail (optional)</label>
                                            <select
                                                id="favorite-thumb-video"
                                                className="favorite-thumb-video-select"
                                                value={thumbnailTargetVideoId}
                                                onChange={(e) => setThumbnailTargetVideoId(e.target.value)}
                                            >
                                                <option value="">Don&apos;t apply as a thumbnail</option>
                                                {ownVideosForThumbnail.map((v) => (
                                                    <option key={v.id} value={v.id}>
                                                        {v.title || 'Untitled video'}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="edit-video-tip">
                                                Choose a video if this image is a catchy thumbnail you created.
                                            </p>
                                        </div>
                                    ) : null}
                                    <div className="form-actions">
                                        <button 
                                            className="save-btn" 
                                            onClick={handleUploadFavorite}
                                            disabled={uploadingFavorite || !newFavorite.title || (!editingFavorite && !newFavorite.image)}
                                        >
                                            {uploadingFavorite
                                                ? (editingFavorite ? 'Saving...' : 'Uploading...')
                                                : (editingFavorite ? 'Save Changes' : 'Upload Image')}
                                        </button>
                                        <button 
                                            className="cancel-btn" 
                                            onClick={resetFavoriteModal}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>
                )}

                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                    <>
                    <div className="analytics-tab">
                        {/* Sales Analytics Section */}
                        <div className="sales-analytics-section">
                            <div className={`section-header analytics-section-header${analyticsError || (isMasterAdmin && !umbrellaOnly) ? ' analytics-section-header--keep' : ''}`}>
                                <div className="analytics-header-row">
                                <h2>Sales Analytics Dashboard</h2>
                                {isMasterAdmin && !umbrellaOnly ? (
                                <div className="analytics-summary">
                                    <button 
                                        onClick={async () => {
                                            if (!window.confirm('⚠️ WARNING: This will permanently delete all your sales data. This action cannot be undone. Are you absolutely sure?')) {
                                                return;
                                            }
                                            
                                            if (!window.confirm('This is your final warning. All sales records will be deleted. Continue?')) {
                                                return;
                                            }
                                            
                                            try {
                                                const BACKEND_URL = 
                                                    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
                                                    "https://screenmerch.fly.dev";
                                                
                                                const userEmail = user?.email || userProfile?.email;
                                                
                                                const response = await fetch(`${BACKEND_URL}/api/admin/reset-sales`, {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        'X-User-Email': userEmail
                                                    },
                                                    body: JSON.stringify({
                                                        user_id: user.id
                                                    })
                                                });
                                                
                                                const data = await response.json();
                                                
                                                if (data.success) {
                                                    alert(`✅ Sales reset successfully! Deleted ${data.deleted_count || 0} sales records.`);
                                                    // Refresh analytics
                                                    fetchAnalytics();
                                                } else {
                                                    alert(`❌ Failed to reset sales: ${data.error || 'Unknown error'}`);
                                                }
                                            } catch (error) {
                                                console.error('Error resetting sales:', error);
                                                alert(`❌ Error resetting sales: ${error.message}`);
                                            }
                                        }}
                                        style={{
                                            marginLeft: '20px',
                                            padding: '8px 16px',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                        title="Reset all sales data (Master Admin only)"
                                    >
                                        🔄 Reset Sales
                                    </button>
                                </div>
                                ) : null}
                                </div>
                                {umbrellaOnly ? (
                                    <p className="umbrella-analytics-intro">
                                        Sales from shoppers who purchased from your storefront.
                                    </p>
                                ) : null}
                                {analyticsError ? (
                                    <p className="umbrella-analytics-intro" role="alert">
                                        {analyticsError}
                                    </p>
                                ) : null}
                            </div>
                            
                            <div className="analytics-dashboard">
                                
                                {/* Enhanced Sales Chart */}
                                <div className="sales-chart-section">
                                    {/* Weekly Summary */}
                                    <div className="weekly-summary">
                                        <h2 className="analytics-mobile-heading">Sales Analytics Dashboard</h2>
                                        <h4>Weekly summary</h4>
                                        {(() => {
                                            const ps = analyticsData.payout_summary || {};
                                            const gross = Number(ps.gross_amount ?? analyticsData.total_revenue ?? 0);
                                            // Umbrella: platform + collaborator come from the same payout_summary ($6/$6)
                                            const collabPay = umbrellaOnly
                                                ? Number(
                                                    ps.collaborator_pay_total
                                                    ?? analyticsData.pay_collaborator_amount
                                                    ?? 0
                                                )
                                                : Number(ps.collaborator_pay_total ?? 0);
                                            const platformFee = umbrellaOnly
                                                ? Number(
                                                    ps.platform_fee_amount
                                                    ?? analyticsData.platform_fee_amount
                                                    ?? collabPay
                                                )
                                                : Number(ps.platform_fee_amount ?? 0);
                                            const ownerPayout = Number(ps.owner_net_payout ?? 0);
                                            const pendingFromScreenmerch = Number(
                                                ps.screenmerch_pending_amount
                                                ?? screenmerchPendingAmount
                                                ?? 0
                                            );
                                            const nextPay = ps.next_payout_date || nextPayoutDate;
                                            const collabPayTotal = collabPay;
                                            const collabFeeTaken = Number(
                                                ps.owner_fee_amount
                                                ?? analyticsData.owner_fee_amount
                                                ?? 0
                                            );
                                            const feePerItem = Number(
                                                ps.owner_fee_per_item
                                                ?? analyticsData.owner_fee_per_item
                                                ?? 0
                                            );
                                            const merchCost = Number(
                                                ps.merch_cost_amount
                                                ?? analyticsData.merch_cost_amount
                                                ?? 0
                                            );
                                            const weekSales = Number(
                                                analyticsData.week_sales_count == null
                                                    ? (analyticsData.daily_sales || []).reduce(
                                                        (sum, day) => sum + Number(day.sales_count || 0),
                                                        0
                                                    )
                                                    : analyticsData.week_sales_count
                                            );
                                            const netLabel = umbrellaOnly
                                                ? 'Your payout'
                                                : (isMasterAdmin ? 'Creator payouts' : 'Your payout');
                                            const netValue = umbrellaOnly
                                                ? (collabPay || (Number(analyticsData.collaborator_net_owed ?? 0) + Number(analyticsData.paid_total ?? 0)))
                                                : (isMasterAdmin ? ownerPayout : pendingFromScreenmerch);
                                            const netSubtitle = umbrellaOnly
                                                ? (feePerItem > 0
                                                    ? `${money(COLLAB_SHARE_PER_ITEM - feePerItem)} per item after ${money(feePerItem)} storefront fee`
                                                    : '$6 per item')
                                                : (isMasterAdmin
                                                    ? 'Owed to storefront owners ($6/item)'
                                                    : (pendingFromScreenmerch > 0
                                                        ? `Pending payout ${formatPayoutDate(nextPay)}`
                                                        : `Paid up · payout ${formatPayoutDate(nextPay)}`));
                                            const payoutCard = (
                                            <div className="summary-card highlight">
                                                <div className="summary-label">{netLabel}</div>
                                                <div className="summary-value">${netValue.toFixed(2)}</div>
                                                <div className="summary-subtitle">{netSubtitle}</div>
                                            </div>
                                            );
                                            const collabFeesCard = (
                                            <div className="summary-card">
                                                <div className="summary-label">Collaborator fees</div>
                                                <div className="summary-value">{money(collabFeeTaken)}</div>
                                                <div className="summary-subtitle">Kept from umbrella sales</div>
                                            </div>
                                            );
                                            return (
                                        <>
                                        <div className={`summary-grid${!isMasterAdmin ? ' summary-grid--five' : ''}`}>
                                            <div className="summary-card">
                                                <div className="summary-label">This week</div>
                                                <div className="summary-value">{weekSales}</div>
                                                <div className="summary-subtitle">Orders</div>
                                            </div>
                                            <div className="summary-card">
                                                <div className="summary-label">Gross Revenue</div>
                                                <div className="summary-value">${gross.toFixed(2)}</div>
                                                <div className="summary-subtitle">Before fees</div>
                                            </div>
                                            {umbrellaOnly || !isMasterAdmin || merchCost > 0 ? (
                                                <div className="summary-card">
                                                    <div className="summary-label">Merch cost</div>
                                                    <div className="summary-value">${merchCost.toFixed(2)}</div>
                                                    <div className="summary-subtitle">Fulfillment overhead</div>
                                                </div>
                                            ) : null}
                                            {isMasterAdmin ? (
                                                <div className="summary-card">
                                                    <div className="summary-label">Platform fee</div>
                                                    <div className="summary-value">${platformFee.toFixed(2)}</div>
                                                    <div className="summary-subtitle">ScreenMerch</div>
                                                </div>
                                            ) : null}
                                            {!umbrellaOnly && (!isMasterAdmin || collabPayTotal > 0 || collaboratorPayoutRows.length > 0) ? (
                                                <div className={`summary-card${collaboratorOwedTotal > 0 && !isMasterAdmin ? ' highlight-collab' : ''}`}>
                                                    <div className="summary-label">Collaborator pay</div>
                                                    <div className="summary-value">${collabPayTotal.toFixed(2)}</div>
                                                    <div className="summary-subtitle">
                                                        {isMasterAdmin
                                                            ? 'Umbrella pages'
                                                            : collaboratorOwedTotal > 0
                                                                ? 'Pay off-platform'
                                                                : 'Paid up'}
                                                    </div>
                                                </div>
                                            ) : null}
                                            {!umbrellaOnly && isMasterAdmin && collabFeeTaken > 0 ? collabFeesCard : null}
                                            {!umbrellaOnly && !isMasterAdmin ? payoutCard : null}
                                            {(umbrellaOnly || isMasterAdmin) ? payoutCard : null}
                                            {umbrellaOnly && analyticsData.collaborator_net_owed > 0 ? (
                                                <div className="summary-card highlight-collab">
                                                    <div className="summary-label">Unpaid balance</div>
                                                    <div className="summary-value">${Number(analyticsData.collaborator_net_owed).toFixed(2)}</div>
                                                    <div className="summary-subtitle">From {analyticsData.storefront_owner_name || 'store owner'}</div>
                                                </div>
                                            ) : null}
                                        </div>
                                        {!umbrellaOnly && !isMasterAdmin ? (
                                            <div className="owner-payout-note-row">
                                                {collabFeesCard}
                                            <div className={`collaborator-payout-panel owner-earnings-panel owner-payout-note${screenmerchPayouts.length > 0 ? ' screenmerch-payments-received' : ''}`}>
                                                <h5>Payments from ScreenMerch</h5>
                                                <p className="hint">
                                                    When ScreenMerch sends you a PayPal payment, the latest one shows here.
                                                    That payout can include collaborator earnings when applicable. You are responsible for paying collaborators their share.
                                                </p>
                                                {screenmerchPayouts.length > 0 ? (
                                                    (() => {
                                                        const sortedPayouts = sortPayoutsNewestFirst(screenmerchPayouts);
                                                        const currentPayout = sortedPayouts[0];
                                                        const previousPayouts = sortedPayouts.slice(1);
                                                        const renderPaymentRow = (payout) => (
                                                            <li key={String(payout.id)} className="screenmerch-payment-row">
                                                                <div className="collab-payout-row-main">
                                                                    <strong className="paid-up-label">
                                                                        Paid ${Number(payout.amount || 0).toFixed(2)} ✓
                                                                    </strong>
                                                                    <span>
                                                                        {formatPayoutDate(payout.paid_at || payout.payout_date)}
                                                                        {payout.payment_method ? ` · ${payout.payment_method}` : ''}
                                                                        {payout.note || payout.notes ? ` · ${payout.note || payout.notes}` : ''}
                                                                    </span>
                                                                </div>
                                                            </li>
                                                        );
                                                        return (
                                                            <>
                                                                <ul className="collaborator-payout-list owner-purchase-log screenmerch-payment-list">
                                                                    {renderPaymentRow(currentPayout)}
                                                                </ul>
                                                                <details className="owner-purchase-log-details screenmerch-all-payments">
                                                                    <summary>
                                                                        All payments ({sortedPayouts.length})
                                                                    </summary>
                                                                    {previousPayouts.length > 0 ? (
                                                                        <ul className="collaborator-payout-list owner-purchase-log screenmerch-payment-list">
                                                                            {previousPayouts.map(renderPaymentRow)}
                                                                        </ul>
                                                                    ) : (
                                                                        <p className="screenmerch-all-payments-empty">
                                                                            This is your first recorded payment.
                                                                        </p>
                                                                    )}
                                                                    {screenmerchPaidTotal > 0 ? (
                                                                        <p className="screenmerch-paid-total">
                                                                            Total received: ${screenmerchPaidTotal.toFixed(2)} ✓
                                                                        </p>
                                                                    ) : null}
                                                                </details>
                                                            </>
                                                        );
                                                    })()
                                                ) : (
                                                    <p className="hint">No ScreenMerch payouts recorded yet.</p>
                                                )}
                                            </div>
                                            </div>
                                            ) : null}
                                        </>
                                            );
                                        })()}
                                        {isMasterAdmin && !umbrellaOnly ? (
                                            <div className="collaborator-payout-panel owner-earnings-panel">
                                                <h5>Storefront owner payments</h5>
                                                <p className="hint">
                                                    ScreenMerch.com does not earn a storefront-owner payout. Record PayPal (or other) payments to storefront owners in{' '}
                                                    <strong>Admin → Payouts</strong>. Each confirmation appears here on that owner&apos;s dashboard.
                                                </p>
                                            </div>
                                        ) : null}
                                        {!umbrellaOnly && !isMasterAdmin ? (
                                            <>
                                            <div className="collaborator-payout-panel owner-earnings-panel">
                                                <h5>Latest Storefront owner earnings log</h5>
                                                <p className="hint">
                                                    Orders are processed manually. As stated in the{' '}
                                                    <Link to="/terms-of-service">Terms of Service</Link> (Section 10), you earn $6 per qualifying item.
                                                    That $6 is Your Earnings in this log, not the rest of the retail price, which covers fulfillment, platform, and processing.
                                                    When ScreenMerch records a payment, this log shows earnings since that payment. Earlier calculations stay in Prior earnings records.
                                                </p>
                                                {(() => {
                                                    const ownerSales = (
                                                        ownerEarningsSummary?.owner_earnings_owner_sales?.length
                                                            ? ownerEarningsSummary.owner_earnings_owner_sales
                                                            : ownerRecentSales
                                                    ) || [];
                                                    const collabSales = [
                                                        ...(
                                                            ownerEarningsSummary?.owner_earnings_collaborator_sales?.length
                                                                ? ownerEarningsSummary.owner_earnings_collaborator_sales
                                                                : collaboratorPayoutRows.flatMap((row) =>
                                                                    (row.recent_sales || []).map((sale) => ({
                                                                        ...sale,
                                                                        display_name: collaboratorPayoutHeading(row),
                                                                    }))
                                                                )
                                                        ),
                                                    ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
                                                    const periods = buildOwnerEarningsPeriods(ownerSales, collabSales, screenmerchPayouts);
                                                    const latest = periods[0];
                                                    const history = periods.slice(1).filter((period) => period.hasActivity);
                                                    const hasAnyEarnings = latest?.hasActivity || history.length > 0;
                                                    if (!hasAnyEarnings) {
                                                        return <p className="hint">No sales recorded yet.</p>;
                                                    }
                                                    return (
                                                        <>
                                                            <OwnerEarningsFigures
                                                                period={latest}
                                                                emptyMessage="No new earnings since the last ScreenMerch payment."
                                                            />
                                                            {screenmerchPayouts.length > 0 ? (
                                                                <details className="owner-purchase-log-details screenmerch-all-payments">
                                                                    <summary>
                                                                        Prior earnings records ({history.length})
                                                                    </summary>
                                                                    {history.length === 0 ? (
                                                                        <p className="screenmerch-all-payments-empty">
                                                                            No earlier earnings records yet.
                                                                        </p>
                                                                    ) : history.map((period) => (
                                                                        <div key={period.key} className="owner-earnings-prior-record">
                                                                            <p className="hint">
                                                                                {period.payout
                                                                                    ? `Included in ScreenMerch payment ${money(period.payout.amount)} · ${formatPayoutDate(period.payout.paid_at || period.payout.payout_date)}${period.payout.payment_method ? ` · ${period.payout.payment_method}` : ''}`
                                                                                    : 'Earlier earnings'}
                                                                            </p>
                                                                            <OwnerEarningsFigures period={period} />
                                                                        </div>
                                                                    ))}
                                                                </details>
                                                            ) : null}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            </>
                                        ) : null}
                                        {!umbrellaOnly && !isMasterAdmin ? (
                                            <div className="collaborator-payout-panel">
                                                <h5>Collaborator payouts</h5>
                                                <p className="hint">
                                                    Record off-platform payments to umbrella collaborators when their owed balance exceeds $50.
                                                    You can choose to set a percentage or flat per-item fee under each creator; if you do, that amount stays with you instead of being paid to them.
                                                </p>
                                                {collaboratorPayoutRows.length === 0 ? (
                                                    <p className="hint">No umbrella collaborator sales recorded yet.</p>
                                                ) : null}
                                                <ul className="collaborator-payout-list">
                                                    {collaboratorPayoutRows.map((row, idx) => {
                                                        const listId = String(row.favorite_list_id);
                                                        const balance = Number(row.balance_owed ?? 0);
                                                        const payCollab = Number(row.pay_collaborator_amount ?? 0);
                                                        const isPaidUp = row.is_paid_up ?? (payCollab > 0 && balance <= 0);
                                                        const canRecord = row.can_record_payout ?? (payCollab > 0 && balance >= 50);
                                                        const draft = collabFeeDrafts[listId] || {
                                                            feeType: row.owner_fee_type || 'none',
                                                            feeValue: (row.owner_fee_type || 'none') === 'none'
                                                                ? ''
                                                                : String(row.owner_fee_value ?? 0),
                                                        };
                                                        const feeAmount = Number(row.owner_fee_amount ?? 0);
                                                        const recentSales = row.recent_sales || [];
                                                        const hasEarningsLog = payCollab > 0 || feeAmount > 0 || recentSales.length > 0;
                                                        return (
                                                            <li key={listId || row.display_name || idx}>
                                                                <div className="collab-payout-row-main">
                                                                    <strong>{collaboratorPayoutHeading(row)}</strong>
                                                                    <div className="collab-payout-amount-row">
                                                                        <span>
                                                                            {payCollab <= 0 ? (
                                                                                <>Owed $0.00</>
                                                                            ) : isPaidUp ? (
                                                                                <span className="paid-up-label">Paid up ✓</span>
                                                                            ) : balance > 0 ? (
                                                                                <>Owed <strong>${balance.toFixed(2)}</strong></>
                                                                            ) : (
                                                                                <>Owed $0.00</>
                                                                            )}
                                                                            {feeAmount > 0 ? (
                                                                                <small className="collab-fee-taken-note">
                                                                                    {' '}Storefront fee {money(feeAmount)} already taken out
                                                                                </small>
                                                                            ) : null}
                                                                        </span>
                                                                        {canRecord ? (
                                                                            <button
                                                                                type="button"
                                                                                className="btn-record-collab-payout"
                                                                                onPointerDown={(ev) => ev.stopPropagation()}
                                                                                onClick={(ev) => {
                                                                                    ev.preventDefault();
                                                                                    ev.stopPropagation();
                                                                                    if (demoPreview) return;
                                                                                    openAnalyticsPayoutModal(row);
                                                                                }}
                                                                                disabled={demoPreview}
                                                                            >
                                                                                Record payment
                                                                            </button>
                                                                        ) : null}
                                                                    </div>
                                                                    {row.last_payout ? (
                                                                        <small>
                                                                            Last paid ${Number(row.last_payout.amount || 0).toFixed(2)} on {formatPayoutDate(row.last_payout.paid_at)}
                                                                            {row.last_payout.note ? ` · ${row.last_payout.note}` : ''}
                                                                        </small>
                                                                    ) : null}
                                                                </div>
                                                                <CollaboratorFeeForm
                                                                    listId={listId}
                                                                    feeType={draft.feeType}
                                                                    feeValue={draft.feeValue}
                                                                    salesFeeAmount={feeAmount}
                                                                    salesItemCount={Number(row.order_count || recentSales.length || 0)}
                                                                    onTypeChange={(nextType) => {
                                                                        updateCollabFeeDraft(listId, {
                                                                            feeType: nextType,
                                                                            feeValue: nextType === 'none'
                                                                                ? ''
                                                                                : (draft.feeValue || (nextType === 'percent' ? '10' : '1')),
                                                                        });
                                                                    }}
                                                                    onValueChange={(nextValue) => updateCollabFeeDraft(listId, { feeValue: nextValue })}
                                                                    onSave={(e) => saveCollabFee(e, row)}
                                                                    saving={savingCollabFeeId === listId}
                                                                    message={collabFeeMessages[listId] || ''}
                                                                    readOnly={demoPreview}
                                                                />
                                                                {hasEarningsLog ? (
                                                                    <details className="owner-purchase-log-details owner-earnings-log collab-purchase-log-details">
                                                                        <summary>Earnings log</summary>
                                                                        <ul className="collaborator-payout-list owner-earnings-log-totals">
                                                                            <li>
                                                                                <div className="collab-payout-row-main">
                                                                                    <strong>Earnings</strong>
                                                                                    <span>${payCollab.toFixed(2)}</span>
                                                                                </div>
                                                                            </li>
                                                                            <li>
                                                                                <div className="collab-payout-row-main">
                                                                                    <strong>Fees</strong>
                                                                                    <span>
                                                                                        {feeAmount > 0
                                                                                            ? `You keep $${feeAmount.toFixed(2)}`
                                                                                            : 'None'}
                                                                                    </span>
                                                                                </div>
                                                                            </li>
                                                                        </ul>
                                                                        {recentSales.length > 0 ? (
                                                                            <ul className="collaborator-payout-list owner-purchase-log">
                                                                                {recentSales.map((sale, idx) => (
                                                                                    <li key={String(sale.id || idx)}>
                                                                                        <div className="collab-payout-row-main">
                                                                                            <strong>{sale.product_name || 'Item'}</strong>
                                                                                            <span>
                                                                                                {formatPayoutDate(sale.created_at)}
                                                                                                {' · '}
                                                                                                {saleSoldLabel(sale)}
                                                                                                {' · '}
                                                                                                {saleCollaboratorPayoutLabel(sale)}
                                                                                            </span>
                                                                                        </div>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        ) : null}
                                                                    </details>
                                                                ) : null}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        ) : null}
                                        {umbrellaOnly ? (() => {
                                            const payCollab = Number(analyticsData.pay_collaborator_amount ?? 0);
                                            const balance = Number(analyticsData.collaborator_net_owed ?? 0);
                                            const isPaidUp = analyticsData.is_paid_up ?? (payCollab > 0 && balance <= 0);
                                            const feeAmount = Number(analyticsData.owner_fee_amount ?? 0);
                                            const feeType = analyticsData.owner_fee_type || 'none';
                                            const feeValue = (feeType === 'none')
                                                ? ''
                                                : String(analyticsData.owner_fee_value ?? 0);
                                            const salesItemCount = productSalesItemCount(analyticsData);
                                            return (
                                            <div className="collaborator-payout-panel">
                                                <p className="hint">
                                                    Same fee and payout status your storefront owner sees.
                                                    They pay you on the 1st and 15th when your owed balance exceeds $50.
                                                    After they record a payment, confirm here that you received it.
                                                </p>
                                                <ul className="collaborator-payout-list">
                                                    <li>
                                                        <div className="collab-payout-row-main">
                                                            <strong>
                                                                {collaboratorPayoutHeading({
                                                                    display_name: analyticsData.page_name,
                                                                    member_label: analyticsData.page_name,
                                                                })}
                                                            </strong>
                                                            <div className="collab-payout-amount-row">
                                                                <span>
                                                                    {payCollab <= 0 ? (
                                                                        <>Owed $0.00</>
                                                                    ) : isPaidUp ? (
                                                                        <span className="paid-up-label">Paid up ✓</span>
                                                                    ) : balance > 0 ? (
                                                                        <>Owed <strong>${balance.toFixed(2)}</strong></>
                                                                    ) : (
                                                                        <>Owed $0.00</>
                                                                    )}
                                                                    {feeAmount > 0 ? (
                                                                        <small className="collab-fee-taken-note">
                                                                            {' '}Storefront fee {money(feeAmount)} already taken out
                                                                        </small>
                                                                    ) : null}
                                                                </span>
                                                            </div>
                                                            {analyticsData.last_payout ? (
                                                                <>
                                                                <small>
                                                                    Storefront recorded ${Number(analyticsData.last_payout.amount || 0).toFixed(2)} on {formatPayoutDate(analyticsData.last_payout.paid_at)}
                                                                    {analyticsData.last_payout.note ? ` · ${analyticsData.last_payout.note}` : ''}
                                                                </small>
                                                                {payoutConfirmedAt(analyticsData.last_payout) ? (
                                                                    <small className="paid-up-label">
                                                                        Received ✓ {formatPayoutDate(payoutConfirmedAt(analyticsData.last_payout))}
                                                                    </small>
                                                                ) : (
                                                                    <div className="collab-payout-amount-row">
                                                                        {collabReceiptError ? (
                                                                            <small className="owner-fee-message error" role="alert">{collabReceiptError}</small>
                                                                        ) : null}
                                                                        <button
                                                                            type="button"
                                                                            className="btn-record-collab-payout"
                                                                            onPointerDown={(ev) => ev.stopPropagation()}
                                                                            onClick={(ev) => {
                                                                                ev.preventDefault();
                                                                                ev.stopPropagation();
                                                                                if (demoPreview) return;
                                                                                submitConfirmCollabReceipt();
                                                                            }}
                                                                            disabled={demoPreview || confirmingCollabReceipt}
                                                                        >
                                                                            {confirmingCollabReceipt ? 'Saving…' : 'Confirm received'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                </>
                                                            ) : null}
                                                        </div>
                                                        <CollaboratorFeeForm
                                                            listId="umbrella-self"
                                                            feeType={feeType}
                                                            feeValue={feeValue}
                                                            salesFeeAmount={feeAmount}
                                                            salesItemCount={salesItemCount}
                                                            onTypeChange={() => {}}
                                                            onValueChange={() => {}}
                                                            onSave={(e) => e.preventDefault()}
                                                            saving={false}
                                                            message=""
                                                            readOnly
                                                            hideSave
                                                            collaboratorView
                                                        />
                                                    </li>
                                                </ul>
                                            </div>
                                            );
                                        })() : null}
                                    </div>

                                    <details className="owner-purchase-log-details owner-earnings-log product-sales-analytics-details">
                                    <summary>
                                        Product sales analytics
                                        {productSalesItemCount(analyticsData) > 0
                                            ? ` (${productSalesItemCount(analyticsData)})`
                                            : ''}
                                    </summary>
                                    <div className="products-sold-chart">
                                    <h3>Products sold</h3>
                                    
                                    {analyticsData.products_sold && analyticsData.products_sold.length > 0 ? (
                                        <div className="products-chart-container">
                                            {analyticsData.products_sold.map((product, index) => {
                                                const maxQuantity = Math.max(...analyticsData.products_sold.map(p => p.quantity));
                                                const barWidth = maxQuantity > 0 ? (product.quantity / maxQuantity) * 100 : 0;
                                                
                                                return (
                                                    <div key={index} className="product-chart-item">
                                                        <div className="product-chart-header">
                                                            <div className="product-name">{product.product}</div>
                                                            <div className="product-stats">
                                                                <span className="quantity">{product.quantity} sold</span>
                                                                <span className="revenue">Gross ${Number(product.revenue || 0).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="product-chart-bar-container">
                                                            <div 
                                                                className="product-chart-bar" 
                                                                style={{width: `${barWidth}%`}}
                                                                title={`${product.quantity} units sold - Gross $${Number(product.revenue || 0).toFixed(2)}`}
                                                            >
                                                                <span className="bar-label">{product.quantity}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="products-chart-empty">
                                            <div className="empty-icon">📦</div>
                                            <h4>No products sold yet</h4>
                                            <p>
                                                {umbrellaOnly
                                                    ? 'Sales attributed to this page will show up here.'
                                                    : 'Start creating content to see your sales data here.'}
                                            </p>
                                        </div>
                                    )}
                                    </div>
                                    {umbrellaOnly && (analyticsData.fee_sales || []).length > 0 ? (
                                        <ul className="collaborator-payout-list owner-purchase-log">
                                            {(analyticsData.fee_sales || []).map((sale, idx) => (
                                                <li key={String(sale.id || idx)}>
                                                    <div className="collab-payout-row-main">
                                                        <strong>{sale.product_name || 'Item'}</strong>
                                                        <span>
                                                            {formatPayoutDate(sale.created_at)}
                                                            {' · '}
                                                            {saleSoldLabel(sale)}
                                                            {' · '}
                                                            {saleCollaboratorPayoutLabel(sale)}
                                                        </span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                    </details>
                                </div>

                            </div>
                        </div>
                    </div>

                    {analyticsPayoutModal ? createPortal(
                        <div
                            className="umbrella-payout-modal-backdrop"
                            onClick={(ev) => {
                                if (ev.target !== ev.currentTarget) return;
                                closeAnalyticsPayoutModal();
                            }}
                            role="presentation"
                        >
                            <div
                                className="umbrella-payout-modal"
                                role="dialog"
                                aria-labelledby="analytics-record-payout-title"
                                onClick={(ev) => ev.stopPropagation()}
                            >
                                <h3 id="analytics-record-payout-title">Record collaborator payment</h3>
                                <p className="hint">
                                    Confirm you paid <strong>{collaboratorPayoutHeading(analyticsPayoutModal)}</strong> off-platform.
                                </p>
                                {analyticsPayoutError ? (
                                    <p className="owner-fee-message error" role="alert">{analyticsPayoutError}</p>
                                ) : null}
                                <form onSubmit={submitAnalyticsPayout}>
                                    <label>
                                        Amount
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={analyticsPayoutAmount}
                                            onChange={(ev) => setAnalyticsPayoutAmount(ev.target.value)}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Date paid
                                        <input
                                            type="date"
                                            value={analyticsPayoutDate}
                                            onChange={(ev) => setAnalyticsPayoutDate(ev.target.value)}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Note (optional)
                                        <input
                                            type="text"
                                            placeholder="PayPal, Zelle, cash…"
                                            value={analyticsPayoutNote}
                                            onChange={(ev) => setAnalyticsPayoutNote(ev.target.value)}
                                        />
                                    </label>
                                    <div className="umbrella-payout-modal-actions">
                                        <button type="button" onClick={() => closeAnalyticsPayoutModal(true)} disabled={recordingAnalyticsPayout}>
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={recordingAnalyticsPayout}>
                                            {recordingAnalyticsPayout ? 'Saving…' : 'Confirm payment'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>,
                        document.body
                    ) : null}
                    </>
                )}

                {/* Personalization Tab */}
                {activeTab === 'personalization' && (
                    <div className="personalization-tab">
                        <PersonalizationSettings readOnly={demoPreview} />
                    </div>
                )}

                {activeTab === 'umbrella' && userProfile?.role === 'creator' && (
                    <div className="umbrella-tab">
                        <div className="section-header">
                            <h2>Umbrella network</h2>
                            <p className="payout-main-description">
                                Manage invites and approved collaborators. Pending responses also appear under{' '}
                                <Link to="/channel-invites">Channel invites</Link> for each user.
                            </p>
                        </div>
                        <ChannelUmbrella previewMode={demoPreview} />
                    </div>
                )}

                {/* Payout Setup Tab */}
                {activeTab === 'payout' && (
                    <div className="payout-tab">
                        <div className="payout-section">
                            <div className="section-header">
                                <p className="payout-main-description">Configure your payment information to receive earnings from your sales</p>
                            </div>

                            {payoutMessage && (
                                <div className={`payout-message ${payoutMessage.includes('error') || payoutMessage.includes('Failed') ? 'error' : 'success'}`}>
                                    {payoutMessage}
                                </div>
                            )}

                            <form 
                                className="payout-form"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    setPayoutLoading(true);
                                    setPayoutMessage('');

                                    try {
                                        if (!user || !user.id) {
                                            throw new Error('User not found');
                                        }

                                        const updateData = {
                                            paypal_email: payoutData.paypal_email.trim()
                                        };

                                        const backendUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || 'https://screenmerch.fly.dev';
                                        const res = await fetch(`${backendUrl}/api/update-creator-settings`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                                            body: JSON.stringify({ user_id: user.id, ...updateData })
                                        });
                                        const apiData = await res.json().catch(() => ({}));

                                        if (res.ok && apiData.success) {
                                            setPayoutMessage('Payout information saved successfully!');
                                            setUserProfile({ ...userProfile, ...updateData });
                                            setTimeout(() => setPayoutMessage(''), 3000);
                                        } else {
                                            const { error } = await supabase
                                                .from('users')
                                                .update(updateData)
                                                .eq('id', user.id)
                                                .select()
                                                .single();
                                            if (error) throw error;
                                            setPayoutMessage('Payout information saved successfully!');
                                            setUserProfile({ ...userProfile, ...updateData });
                                            setTimeout(() => setPayoutMessage(''), 3000);
                                        }
                                    } catch (error) {
                                        console.error('Error saving payout info:', error);
                                        setPayoutMessage(`Failed to save payout information: ${error.message}`);
                                    } finally {
                                        setPayoutLoading(false);
                                    }
                                }}
                            >
                                <div className="payout-form-group">
                                    <label htmlFor="paypal-email" className="payout-label">
                                        PayPal Email <span className="required">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="paypal-email"
                                        className="payout-input"
                                        placeholder="your.email@example.com"
                                        value={demoPreview ? 'creator@example.com' : payoutData.paypal_email}
                                        onChange={(e) => setPayoutData({ ...payoutData, paypal_email: e.target.value })}
                                        disabled={payoutLoading || demoPreview}
                                        readOnly={demoPreview}
                                        required
                                    />
                                    <p className="payout-help-text">
                                        This is where we'll send your earnings. Make sure it's a valid PayPal account.
                                    </p>
                                </div>

                                <div className="payout-form-actions">
                                    <button
                                        type="submit"
                                        className="payout-save-btn"
                                        disabled={payoutLoading || demoPreview || !payoutData.paypal_email.trim()}
                                    >
                                        {payoutLoading ? (
                                            <>
                                                <span className="loading-spinner-small"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            '💾 Save Payout Information'
                                        )}
                                    </button>
                                </div>
                            </form>

                            <div className="payout-info-box">
                                <h3>ℹ️ Important Information</h3>
                                <ul>
                                    <li>Your payout information is encrypted and stored securely</li>
                                    <li>Payments are processed monthly after you reach the minimum payout threshold</li>
                                    <li>You can update your payout information at any time</li>
                                    <li>Make sure your PayPal email is correct to avoid payment delays</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Edit Video Modal */}
            {editingVideo && (
                <div className="edit-video-modal-overlay" onClick={handleCancelEdit}>
                    <div className="edit-video-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-video-modal-header">
                            <h2>Edit Video</h2>
                            <button className="edit-video-modal-close" onClick={handleCancelEdit}>×</button>
                        </div>
                        <div className="edit-video-modal-content" ref={modalContentRef}>
                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-title">Video Name</label>
                                <input
                                    type="text"
                                    id="edit-video-title"
                                    value={editVideoForm.title}
                                    onChange={(e) => setEditVideoForm({ ...editVideoForm, title: e.target.value })}
                                    placeholder="Enter video name"
                                    className="edit-video-input"
                                />
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-thumbnail">Thumbnail</label>
                                <div className="edit-video-thumbnail-preview">
                                    {(thumbnailPreview || editVideoForm.thumbnail) && (
                                        <img 
                                            src={thumbnailPreview || editVideoForm.thumbnail} 
                                            alt="Thumbnail preview" 
                                            className="thumbnail-preview-img"
                                        />
                                    )}
                                </div>
                                <input
                                    type="file"
                                    id="edit-video-thumbnail"
                                    accept="image/*"
                                    onChange={handleThumbnailChange}
                                    disabled={uploadingThumbnail}
                                    className="edit-video-file-input"
                                />
                                <label htmlFor="edit-video-thumbnail" className="edit-video-file-label">
                                    {uploadingThumbnail ? '⏳ Uploading...' : '📷 Choose Thumbnail Image'}
                                </label>
                                <p className="edit-video-tip">Max 5MB, recommended: 1280x720</p>
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-url">Video URL</label>
                                <input
                                    type="text"
                                    id="edit-video-url"
                                    value={editVideoForm.video_url}
                                    onChange={(e) => setEditVideoForm({ ...editVideoForm, video_url: e.target.value })}
                                    placeholder="Enter video URL (YouTube or direct link)"
                                    className="edit-video-input"
                                />
                                <p className="edit-video-tip">Or upload a video file below</p>
                            </div>

                            <div className="edit-video-form-group">
                                <label htmlFor="edit-video-file">Upload Video File</label>
                                <input
                                    type="file"
                                    id="edit-video-file"
                                    accept="video/*"
                                    onChange={handleVideoFileChange}
                                    disabled={uploadingVideoFile}
                                    className="edit-video-file-input"
                                />
                                <label htmlFor="edit-video-file" className="edit-video-file-label">
                                    {uploadingVideoFile ? '⏳ Uploading...' : '🎬 Choose Video File'}
                                </label>
                                <p className="edit-video-tip">Max file size depends on your plan</p>
                            </div>
                        </div>
                        <div className="edit-video-modal-footer">
                            <button className="edit-video-cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                            <button className="edit-video-save-btn" onClick={handleSaveVideo} disabled={uploadingThumbnail || uploadingVideoFile}>
                                {uploadingThumbnail || uploadingVideoFile ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard; 
