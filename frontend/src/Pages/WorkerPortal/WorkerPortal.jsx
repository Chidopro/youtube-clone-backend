import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './WorkerPortal.css';

function WorkerPortal() {
  const [orders, setOrders] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [status, setStatus] = useState('assigned'); // assigned, pending, completed
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadQueue();
    // Refresh queue every 30 seconds
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, [status]);

  const loadQueue = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'Please log in to access the worker portal' });
        return;
      }

      const token = session.access_token;

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev'}/api/secure/queue?status=${status}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();
      if (result.success) {
        setOrders(result.orders || []);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to load orders' });
      }
    } catch (error) {
      console.error('Error loading queue:', error);
      setMessage({ type: 'error', text: 'Failed to load orders. Please try again.' });
    }
  };

  const processAndSubmitOrder = async (orderId) => {
    if (processing) return;

    setProcessing(true);
    setMessage({ type: '', text: '' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'Please log in' });
        setProcessing(false);
        return;
      }

      const token = session.access_token;

      // Show processing steps
      setMessage({ type: 'info', text: 'Processing image with 300 DPI...' });

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev'}/api/worker/process-and-submit`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: orderId,
            notes: `Processed by worker at ${new Date().toISOString()}`
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `✅ Order processed and submitted successfully! Printful Order ID: ${result.printful_order_id}. Payment automatically charged to account.`
        });
        
        // Refresh queue after successful processing
        setTimeout(() => {
          loadQueue();
          setMessage({ type: '', text: '' });
        }, 2000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to process order' });
      }
    } catch (error) {
      console.error('Error processing order:', error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setProcessing(false);
    }
  };

  const claimOrder = async (queueId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'Please log in' });
        return;
      }

      const token = session.access_token;

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://screenmerch.fly.dev'}/api/secure/claim-order`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ queue_id: queueId })
        }
      );

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Order claimed successfully!' });
        loadQueue();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to claim order' });
      }
    } catch (error) {
      console.error('Error claiming order:', error);
      setMessage({ type: 'error', text: 'Failed to claim order' });
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
  };

  const getPriorityBadge = (priority) => {
    if (priority === 2) return <span className="priority-badge urgent">Urgent</span>;
    if (priority === 1) return <span className="priority-badge high">High</span>;
    return <span className="priority-badge normal">Normal</span>;
  };

  return (
    <div className="worker-portal">
      <div className="worker-portal-header">
        <h1>🛠️ Worker Portal - Order Processing</h1>
        <p className="subtitle">Process orders and submit to Printful automatically</p>
      </div>

      {/* Status Tabs */}
      <div className="status-tabs">
        <button
          className={`tab ${status === 'assigned' ? 'active' : ''}`}
          onClick={() => setStatus('assigned')}
        >
          Assigned ({orders.filter(o => o.status === 'assigned').length})
        </button>
        <button
          className={`tab ${status === 'pending' ? 'active' : ''}`}
          onClick={() => setStatus('pending')}
        >
          Available ({orders.filter(o => o.status === 'pending').length})
        </button>
        <button
          className={`tab ${status === 'completed' ? 'active' : ''}`}
          onClick={() => setStatus('completed')}
        >
          Completed ({orders.filter(o => o.status === 'completed').length})
        </button>
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Orders List */}
      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="empty-state">
            <p>No orders found in this category.</p>
          </div>
        ) : (
          orders.map((queueItem) => {
            const order = queueItem.orders || {};
            const orderId = order.order_id || queueItem.order_id;
            
            return (
              <div key={queueItem.id} className="order-card">
                <div className="order-header">
                  <div className="order-info">
                    <h3>Order #{orderId ? orderId.slice(0, 8) : 'N/A'}</h3>
                    <p className="order-meta">
                      Created: {new Date(queueItem.created_at).toLocaleDateString()}
                      {queueItem.priority !== undefined && getPriorityBadge(queueItem.priority)}
                    </p>
                  </div>
                  <div className="order-status">
                    <span className={`status-badge ${queueItem.status}`}>
                      {queueItem.status}
                    </span>
                  </div>
                </div>

                {order.cart && order.cart.length > 0 && (
                  <div className="order-items">
                    <p><strong>Items:</strong> {order.cart.length}</p>
                    <ul>
                      {order.cart.slice(0, 3).map((item, idx) => (
                        <li key={idx}>
                          {item.product} - {item.variants?.color} - {item.variants?.size}
                        </li>
                      ))}
                      {order.cart.length > 3 && <li>...and {order.cart.length - 3} more</li>}
                    </ul>
                  </div>
                )}

                {order.video_title && (
                  <div className="order-video-info">
                    <p><strong>Video:</strong> {order.video_title}</p>
                    <p><strong>Creator:</strong> {order.creator_name}</p>
                  </div>
                )}

                <div className="order-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => viewOrderDetails(order)}
                  >
                    View Details
                  </button>
                  
                  {queueItem.status === 'pending' && (
                    <button
                      className="btn-primary"
                      onClick={() => claimOrder(queueItem.id)}
                    >
                      Claim Order
                    </button>
                  )}
                  
                  {queueItem.status === 'assigned' && (
                    <button
                      className="btn-primary process-btn"
                      onClick={() => processAndSubmitOrder(orderId)}
                      disabled={processing}
                    >
                      {processing ? (
                        <>
                          <span className="spinner"></span>
                          Processing...
                        </>
                      ) : (
                        '🚀 Process & Submit to Printful'
                      )}
                    </button>
                  )}
                </div>

                {queueItem.worker_notes && (
                  <div className="worker-notes">
                    <p><strong>Notes:</strong> {queueItem.worker_notes}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={closeOrderDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeOrderDetails}>×</button>
            <h2>Order Details</h2>
            <div className="order-details">
              <p><strong>Order ID:</strong> {selectedOrder.order_id}</p>
              <p><strong>Video Title:</strong> {selectedOrder.video_title || 'N/A'}</p>
              <p><strong>Creator:</strong> {selectedOrder.creator_name || 'N/A'}</p>
              <p><strong>Total:</strong> ${selectedOrder.total_amount || 0}</p>
              
              {selectedOrder.cart && (
                <div className="cart-items">
                  <h3>Cart Items:</h3>
                  {selectedOrder.cart.map((item, idx) => (
                    <div key={idx} className="cart-item">
                      <p><strong>{item.product}</strong></p>
                      <p>Color: {item.variants?.color || 'N/A'}</p>
                      <p>Size: {item.variants?.size || 'N/A'}</p>
                      <p>Price: ${item.price || 0}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkerPortal;

