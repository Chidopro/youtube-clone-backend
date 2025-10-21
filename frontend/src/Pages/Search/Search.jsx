import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './Search.css';
import { API_CONFIG } from '../../config/apiConfig';

const Search = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');

    useEffect(() => {
        const searchQuery = searchParams.get('q');
        if (searchQuery) {
            setQuery(searchQuery);
            performSearch(searchQuery);
        }
    }, [searchParams]);

    const performSearch = async (searchQuery) => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setError('Please enter at least 2 characters to search');
            return;
        }

        setLoading(true);
        setError('');
        setResults([]);

        try {
            // Try to navigate directly to channel page instead of using search API
            const channelName = searchQuery.trim();
            console.log('Searching for channel:', channelName);
            
            // Navigate directly to the channel page
            navigate(`/channel/${encodeURIComponent(channelName)}`);
            
        } catch (err) {
            console.error('Search error:', err);
            setError(`Search error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatorClick = (creator) => {
        // Navigate to profile using username
        navigate(`/profile/${creator.username}`);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="search-page">
            <div className="search-container">
                <div className="search-header">
                    <h1>Search Results</h1>
                    {query && (
                        <p className="search-query">
                            Results for: <span className="query-text">"{query}"</span>
                        </p>
                    )}
                </div>

                {loading && (
                    <div className="search-loading">
                        <div className="loading-spinner"></div>
                        <p>Searching creators...</p>
                    </div>
                )}

                {error && (
                    <div className="search-error">
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && results.length === 0 && query && (
                    <div className="search-no-results">
                        <h3>No creators found</h3>
                        <p>Try searching with different keywords or check the spelling.</p>
                        <div className="search-suggestions">
                            <p><strong>Tips:</strong></p>
                            <ul>
                                <li>Use shorter keywords</li>
                                <li>Try searching by username or display name</li>
                                <li>Check for typos</li>
                            </ul>
                        </div>
                    </div>
                )}

                {!loading && results.length > 0 && (
                    <div className="search-results">
                        <div className="results-header">
                            <p className="results-count">
                                Found {results.length} creator{results.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        <div className="creators-grid">
                            {results.map((creator) => (
                                <div 
                                    key={creator.id} 
                                    className="creator-card"
                                    onClick={() => handleCreatorClick(creator)}
                                >
                                    <div className="creator-avatar">
                                        {creator.profile_image_url ? (
                                            <img 
                                                src={creator.profile_image_url} 
                                                alt={creator.display_name}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div 
                                            className="avatar-placeholder"
                                            style={{ display: creator.profile_image_url ? 'none' : 'flex' }}
                                        >
                                            {creator.display_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                    </div>

                                    <div className="creator-info">
                                        <h3 className="creator-name">{creator.display_name}</h3>
                                        <p className="creator-username">@{creator.username}</p>
                                        
                                        {creator.bio && (
                                            <p className="creator-bio">{creator.bio}</p>
                                        )}

                                        <div className="creator-stats">
                                            <span className="video-count">
                                                {creator.video_count || 0} video{(creator.video_count || 0) !== 1 ? 's' : ''}
                                            </span>
                                            <span className="joined-date">
                                                Joined {formatDate(creator.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="creator-action">
                                        <button className="view-profile-btn">
                                            View Profile
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Search;
