import React, { useState, useEffect } from 'react'

import '../../App.css'

import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Search from './Search'
import { getUser, logout } from '../../utils/helpers'

const Header = ({ cartItems }) => {
    const [user, setUser] = useState(null)
    const navigate = useNavigate()

    const logoutHandler = () => {
        // pass a callback to logout so it can perform cleanup then navigate
        logout(() => navigate('/'));

        toast.success('log out', {
            position: 'bottom-right'
        });
    }

    useEffect(() => {
        // set initial user on mount
        setUser(getUser());

        // update user whenever auth changes (login/logout)
        const handler = () => setUser(getUser());
        window.addEventListener('authChanged', handler);
        return () => window.removeEventListener('authChanged', handler);
    }, []);

    return (
        <>
            <nav className="navbar row">
                <div className="col-12 col-md-3">
                    <div className="navbar-brand">
                        <Link to="/">
                        {/* image for header logo*/}
                            <img src="./images/" />
                        </Link>

                    </div>
                </div>
                <Search />
                {/* <div className="col-12 col-md-3 mt-4 mt-md-0 text-center">

                    <Link to="/login" className="btn ml-4" id="login_btn">Login</Link>
                </div> */}
                <div className="col-12 col-md-3 mt-4 mt-md-0 text-center">

                    {user ? (<div className="ml-4 dropdown d-inline">
                        <Link to="#!" className="btn dropdown-toggle text-white mr-4" type="button" id="dropDownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <figure className="avatar avatar-nav">
                                <img
                                    src={user?.avatar?.url || '/images/default_avatar.jpg'}
                                    alt={user?.name || 'User'}
                                    className="rounded-circle"
                                />
                            </figure>
                            <span>{user && user.name}</span>
                        </Link>

                        <div className="dropdown-menu" aria-labelledby="dropDownMenuButton">
                            {user && user.role === 'admin' && (
                                <Link className="dropdown-item" to="/dashboard">Dashboard</Link>
                            )}
                            <Link className="dropdown-item" to="/orders/me">Orders</Link>
                            <Link className="dropdown-item" to="/me">Profile</Link>

                            <Link
                                className="dropdown-item text-danger" to="/" onClick={logoutHandler}
                            >
                                Logout
                            </Link>
                        </div>
                    </div>) : <Link to="/login" className="btn ml-4" id="login_btn">Login</Link>}

                    {user && (
                        <Link to="/cart" style={{ textDecoration: 'none' }} >
                            <span id="cart" className="ml-3">Cart</span>
                            <span className="ml-1" id="cart_count">{cartItems ? cartItems.length : null}</span>
                        </Link>
                    )}
                    {/* <span className="ml-1" id="cart_count">{cartItems ? cartItems.length : null}</span>  */}
                </div>

            </nav>

        </>
    )
}

export default Header