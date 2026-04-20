# 쿠팡 Wing API 클라이언트
# 매출 내역, 상품 목록, 정산 데이터 조회

import httpx
from datetime import datetime, timedelta
from .auth import build_authorization

BASE_URL = "https://api-gateway.coupang.com"


class CoupangClient:
    def __init__(self, access_key: str, secret_key: str, vendor_id: str):
        self.access_key = access_key
        self.secret_key = secret_key
        self.vendor_id  = vendor_id

    def _headers(self, method: str, path: str, query: str = '') -> dict:
        return build_authorization(self.access_key, self.secret_key, method, path, query)

    async def get(self, path: str, params: dict = None) -> dict:
        query = ''
        if params:
            query = '&'.join(f"{k}={v}" for k, v in sorted(params.items()))
        headers = self._headers('GET', path, query)
        url = BASE_URL + path + (f'?{query}' if query else '')
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(url, headers=headers)
            res.raise_for_status()
            return res.json()

    # ── 주문 목록 (매출 원천) ─────────────────────────────────
    async def get_orders(self, created_at_from: str, created_at_to: str) -> dict:
        """
        주문 목록 조회
        created_at_from/to: 'yyyy-MM-ddTHH:mm:ss' 형식
        """
        path = f"/v2/providers/seller_api/apis/api/v1/vendors/{self.vendor_id}/ordersheets"
        params = {
            'createdAtFrom': created_at_from,
            'createdAtTo':   created_at_to,
            'status':        'ACCEPT',
            'maxPerPage':    '100',
        }
        return await self.get(path, params)

    # ── 정산 내역 ─────────────────────────────────────────────
    async def get_settlements(self, year: int, month: int) -> dict:
        """월별 정산 내역 조회"""
        path = f"/v2/providers/seller_api/apis/api/v1/vendors/{self.vendor_id}/revenue-history"
        params = {
            'year':  str(year),
            'month': str(month).zfill(2),
        }
        return await self.get(path, params)

    # ── 상품 목록 ─────────────────────────────────────────────
    async def get_products(self, next_token: str = '', max_per_page: int = 50) -> dict:
        """
        판매 중인 상품 목록 조회
        """
        path = f"/v2/providers/seller_api/apis/api/v1/vendors/{self.vendor_id}/products/search"
        params = {
            'status':     'APPROVED',
            'maxPerPage': str(max_per_page),
        }
        if next_token:
            params['nextToken'] = next_token
        return await self.get(path, params)

    # ── 광고비 (로켓그로스 정산) ──────────────────────────────
    async def get_ad_cost(self, year: int, month: int) -> dict:
        """월별 광고비 조회 (쿠팡애즈)"""
        path = f"/v2/providers/seller_api/apis/api/v1/vendors/{self.vendor_id}/ad-cost"
        params = {
            'year':  str(year),
            'month': str(month).zfill(2),
        }
        return await self.get(path, params)


# ── 순수익 계산 ───────────────────────────────────────────────

def calc_net_profit(
    sell_price: float,
    cost_price: float,
    commission_rate: float,   # % 예: 10.8
    shipping: float,
    ad_cost: float,
    quantity: int = 1,
) -> dict:
    """
    단순 순수익 계산 (수동 원가 입력 시 사용)
    """
    commission_amt  = sell_price * (commission_rate / 100)
    revenue         = sell_price * quantity
    total_cost      = cost_price * quantity
    total_commission = commission_amt * quantity
    total_shipping  = shipping * quantity
    total_ad        = ad_cost * quantity
    total_expense   = total_cost + total_commission + total_shipping + total_ad
    net_profit      = revenue - total_expense
    margin          = (net_profit / revenue * 100) if revenue > 0 else 0

    return {
        'revenue':          round(revenue),
        'total_cost':       round(total_cost),
        'total_commission': round(total_commission),
        'total_shipping':   round(total_shipping),
        'total_ad':         round(total_ad),
        'total_expense':    round(total_expense),
        'net_profit':       round(net_profit),
        'margin':           round(margin, 1),
        'unit_profit':      round(sell_price - cost_price - commission_amt - shipping - ad_cost),
    }
