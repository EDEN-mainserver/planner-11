# 쿠팡 API 라우터
# POST /coupang/connect     — API 키 연결 테스트
# GET  /coupang/sales       — 기간별 매출 조회
# GET  /coupang/products    — 상품 목록 조회
# GET  /coupang/profit      — 실시간 순수익 대시보드
# GET  /coupang/settlements — 월별 정산 내역

from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.coupang.client import CoupangClient, calc_net_profit

router = APIRouter(prefix="/coupang", tags=["coupang"])


# ── 요청 모델 ─────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    access_key: str
    secret_key: str
    vendor_id:  str


class ProfitRequest(BaseModel):
    access_key:      str
    secret_key:      str
    vendor_id:       str
    cost_map:        dict[str, float] = {}   # { vendorItemId: 원가 }
    days:            int = 7                 # 최근 N일


# ── 연결 테스트 ───────────────────────────────────────────────

@router.post("/connect")
async def test_connection(req: ConnectRequest):
    """API 키 유효성 검증"""
    client = CoupangClient(req.access_key, req.secret_key, req.vendor_id)
    try:
        now = datetime.utcnow()
        result = await client.get_orders(
            created_at_from=(now - timedelta(days=1)).strftime('%Y-%m-%dT00:00:00'),
            created_at_to=now.strftime('%Y-%m-%dT23:59:59'),
        )
        return {"ok": True, "message": "연결 성공"}
    except Exception as e:
        msg = str(e)
        if '401' in msg or 'Unauthorized' in msg:
            raise HTTPException(status_code=401, detail="API 키가 올바르지 않습니다.")
        raise HTTPException(status_code=500, detail=f"연결 실패: {msg}")


# ── 매출 조회 ─────────────────────────────────────────────────

@router.post("/sales")
async def get_sales(req: ConnectRequest, days: int = Query(default=7, ge=1, le=90)):
    """최근 N일 주문/매출 데이터"""
    client = CoupangClient(req.access_key, req.secret_key, req.vendor_id)
    now = datetime.utcnow()
    try:
        data = await client.get_orders(
            created_at_from=(now - timedelta(days=days)).strftime('%Y-%m-%dT00:00:00'),
            created_at_to=now.strftime('%Y-%m-%dT23:59:59'),
        )
        orders = data.get('data', [])

        # 일별 매출 집계
        daily: dict[str, int] = {}
        total_revenue = 0
        total_qty = 0

        for order in orders:
            date = order.get('orderedAt', '')[:10]
            items = order.get('orderItems', [])
            for item in items:
                price = item.get('salesPrice', 0)
                qty   = item.get('quantity', 1)
                daily[date] = daily.get(date, 0) + price * qty
                total_revenue += price * qty
                total_qty     += qty

        daily_list = sorted([{'date': d, 'revenue': v} for d, v in daily.items()], key=lambda x: x['date'])

        return {
            'total_revenue': total_revenue,
            'total_qty':     total_qty,
            'order_count':   len(orders),
            'daily':         daily_list,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 상품 목록 ─────────────────────────────────────────────────

@router.post("/products")
async def get_products(req: ConnectRequest):
    """판매 중인 상품 목록"""
    client = CoupangClient(req.access_key, req.secret_key, req.vendor_id)
    try:
        data = await client.get_products()
        products = data.get('data', {}).get('items', [])
        return {
            'products': [
                {
                    'vendor_item_id': p.get('vendorItemId'),
                    'item_name':      p.get('itemName', ''),
                    'sell_price':     p.get('salePrice', 0),
                    'stock':          p.get('maximumBuyCount', 0),
                    'status':         p.get('statusName', ''),
                }
                for p in products
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 실시간 순수익 대시보드 ────────────────────────────────────

@router.post("/profit")
async def get_profit_dashboard(req: ProfitRequest):
    """
    실시간 순수익 계산
    - 쿠팡 API에서 매출·수수료 가져오기
    - cost_map(원가)은 프론트에서 입력받아 서버로 전달
    """
    client = CoupangClient(req.access_key, req.secret_key, req.vendor_id)
    now = datetime.utcnow()

    try:
        # 주문 데이터
        order_data = await client.get_orders(
            created_at_from=(now - timedelta(days=req.days)).strftime('%Y-%m-%dT00:00:00'),
            created_at_to=now.strftime('%Y-%m-%dT23:59:59'),
        )

        # 정산 데이터 (이번 달)
        try:
            settlement = await client.get_settlements(now.year, now.month)
            settled_commission = settlement.get('data', {}).get('totalFee', 0)
        except Exception:
            settled_commission = None

        orders = order_data.get('data', [])

        # 상품별 집계
        product_summary: dict[str, dict] = {}
        total_revenue    = 0
        total_commission = 0
        total_qty        = 0

        for order in orders:
            for item in order.get('orderItems', []):
                vid          = str(item.get('vendorItemId', ''))
                name         = item.get('itemName', '알 수 없는 상품')
                sell_price   = item.get('salesPrice', 0)
                qty          = item.get('quantity', 1)
                commission   = item.get('commissionPrice', sell_price * 0.108)  # 없으면 10.8% 추정

                if vid not in product_summary:
                    product_summary[vid] = {
                        'vendor_item_id': vid,
                        'item_name':      name,
                        'sell_price':     sell_price,
                        'cost_price':     req.cost_map.get(vid, 0),
                        'qty':            0,
                        'revenue':        0,
                        'commission':     0,
                    }
                product_summary[vid]['qty']        += qty
                product_summary[vid]['revenue']    += sell_price * qty
                product_summary[vid]['commission'] += commission * qty
                total_revenue    += sell_price * qty
                total_commission += commission * qty
                total_qty        += qty

        # 순수익 계산
        items_result = []
        total_cost       = 0
        total_net_profit = 0

        for vid, p in product_summary.items():
            cost      = p['cost_price'] * p['qty']
            net       = p['revenue'] - cost - p['commission']
            margin    = (net / p['revenue'] * 100) if p['revenue'] > 0 else 0
            total_cost       += cost
            total_net_profit += net
            items_result.append({
                **p,
                'cost':       round(cost),
                'net_profit': round(net),
                'margin':     round(margin, 1),
                'has_cost':   p['cost_price'] > 0,
            })

        items_result.sort(key=lambda x: x['revenue'], reverse=True)

        total_margin = (total_net_profit / total_revenue * 100) if total_revenue > 0 else 0

        return {
            'period_days':       req.days,
            'total_revenue':     round(total_revenue),
            'total_cost':        round(total_cost),
            'total_commission':  round(total_commission),
            'total_net_profit':  round(total_net_profit),
            'total_margin':      round(total_margin, 1),
            'total_qty':         total_qty,
            'order_count':       len(orders),
            'settled_commission': settled_commission,
            'items':             items_result,
            'missing_cost_count': sum(1 for i in items_result if not i['has_cost']),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 월별 정산 ─────────────────────────────────────────────────

@router.post("/settlements")
async def get_settlements(req: ConnectRequest, year: int = Query(default=None), month: int = Query(default=None)):
    """월별 정산 내역"""
    now = datetime.utcnow()
    y = year  or now.year
    m = month or now.month
    client = CoupangClient(req.access_key, req.secret_key, req.vendor_id)
    try:
        data = await client.get_settlements(y, m)
        return data.get('data', {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
