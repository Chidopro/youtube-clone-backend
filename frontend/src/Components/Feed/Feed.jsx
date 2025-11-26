import React from 'react'
import './Feed.css'
import { value_converter } from '../../data'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'

const Feed = ({ videos }) => {
    const navigate = useNavigate();
    return (
        <div className='feed'>
            {videos.map((item) => {
                return (
                    <div
                        key={item.id}
                        className="card"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            console.log('Clicked item:', item);
                            navigate(`/video/${item.categoryId || 0}/${item.id}`);
                        }}
                    >
                        <img src={item.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail'} alt="" />
                        <h2>{item.title}</h2>
                        <h3>{item.channelTitle || 'Creator'}</h3>
                    </div>
                );
            })}
        </div>
    )
}

export default Feed;
