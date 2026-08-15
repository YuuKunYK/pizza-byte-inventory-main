import React from 'react';
import { POSSale } from '@/types/pos';
import { formatCurrency } from '@/types/pos';
import { formatDateTime } from '@/lib/pos-utils';

interface ReceiptPrintProps {
  sale: POSSale;
  branchName?: string;
  branchAddress?: string;
  cashierName?: string;
}

export const ReceiptPrint: React.FC<ReceiptPrintProps> = ({
  sale,
  branchName = 'New York Pizza',
  branchAddress = '',
  cashierName,
}) => {
  return (
    <div className="hidden print:block w-[80mm] mx-auto p-4 font-mono text-xs">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">{branchName}</h1>
        {branchAddress && <p className="text-xs">{branchAddress}</p>}
        <p className="text-xs mt-2">Receipt</p>
      </div>

      {/* Order Info */}
      <div className="border-t border-b border-dashed py-2 mb-2 space-y-1">
        <div className="flex justify-between">
          <span>Order #:</span>
          <span className="font-bold">{sale.order_number}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDateTime(sale.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="uppercase">{sale.order_type}</span>
        </div>
        <div className="flex justify-between">
          <span>Payment:</span>
          <span className="uppercase">{sale.payment_method}</span>
        </div>
        {sale.table_number && (
          <div className="flex justify-between">
            <span>Table:</span>
            <span>{sale.table_number}</span>
          </div>
        )}
        {sale.customer_name && (
          <div className="flex justify-between">
            <span>Customer:</span>
            <span>{sale.customer_name}</span>
          </div>
        )}
        {cashierName && (
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{cashierName}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mb-2">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">Item</th>
              <th className="text-center py-1">Qty</th>
              <th className="text-right py-1">Price</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {(sale.items as any[]).map((item, index) => (
              <tr key={index} className="border-b border-dashed">
                <td className="py-1">{item.name}</td>
                <td className="text-center py-1">{item.quantity}</td>
                <td className="text-right py-1">{formatCurrency(item.price)}</td>
                <td className="text-right py-1">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-t border-b border-dashed py-2 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount_amount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-{formatCurrency(sale.discount_amount)}</span>
          </div>
        )}
        {sale.tax > 0 && (
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>{formatCurrency(sale.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold pt-1">
          <span>TOTAL:</span>
          <span>{formatCurrency(sale.total_amount)}</span>
        </div>
        {sale.amount_tendered ? (
          <>
            <div className="flex justify-between">
              <span>Tendered:</span>
              <span>{formatCurrency(sale.amount_tendered)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change:</span>
              <span>{formatCurrency(sale.change_due || 0)}</span>
            </div>
          </>
        ) : null}
      </div>

      {/* Notes */}
      {sale.notes && (
        <div className="my-2 py-2 border-t border-dashed">
          <p className="text-xs">
            <strong>Note:</strong> {sale.notes}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-4 pt-2 border-t border-dashed">
        <p className="text-xs">Thank you for your order!</p>
        <p className="text-xs mt-1">Visit us again soon</p>
      </div>
    </div>
  );
};

/**
 * Function to trigger print
 */
export const printReceipt = () => {
  window.print();
};

