const User = require('../models/user');


const crypto = require('crypto')
const cloudinary = require('cloudinary')
const sendEmail = require('../utils/sendEmail')

exports.registerUser = async (req, res, next) => {
    console.log('register payload:', { body: req.body, file: req.file && { originalname: req.file.originalname, mimetype: req.file.mimetype } });
    try {
        // Cloudinary upload can accept a data URI (base64) or a file path/stream. Support both.
        let uploadTarget = null;
        if (req.file && req.file.path) {
            uploadTarget = req.file.path; // multer saved a temporary file
        } else if (req.body.avatar) {
            uploadTarget = req.body.avatar; // maybe a base64 data URI or a front-end path
        }

        let result = { public_id: 'default_avatar', secure_url: '/images/default_avatar.jpg' };

        // If uploadTarget appears to be a real upload (data URI or an absolute/http URL or a file path), try uploading.
        const looksLikeDataUri = typeof uploadTarget === 'string' && uploadTarget.startsWith('data:');
        const looksLikeHttpUrl = typeof uploadTarget === 'string' && (uploadTarget.startsWith('http://') || uploadTarget.startsWith('https://'));
        const looksLikeFrontendPath = typeof uploadTarget === 'string' && uploadTarget.startsWith('/images/');

        if (uploadTarget && (looksLikeDataUri || looksLikeHttpUrl || req.file && req.file.path)) {
            // Only attempt Cloudinary upload for actual data URIs, http(s) URLs, or real file paths from multer
            result = await cloudinary.v2.uploader.upload(uploadTarget, {
                folder: 'avatars',
                width: 150,
                crop: 'scale',
            });
        } else if (looksLikeFrontendPath) {
            // The frontend sent a local/frontend path (e.g. '/images/default_avatar.jpg') — use it as-is
            result = { public_id: 'default_avatar', secure_url: uploadTarget };
        }

        const { name, email, password } = req.body;

        // Basic validation: ensure required fields are present
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email and password are required' });
        }

        const user = await User.create({
            name,
            email,
            password,
            avatar: {
                public_id: result.public_id,
                url: result.secure_url,
            },
        });
    //test token
    const token = user.getJwtToken();

    return res.status(201).json({
        success: true,
        user,
        token,
    });
    } catch (err) {
        // Duplicate key (email already exists)
        if (err && err.code === 11000) {
            const field = Object.keys(err.keyValue || {}).join(', ');
            const message = field ? `${field} already exists` : 'Duplicate key error';
            console.error('registerUser duplicate error:', message);
            return res.status(400).json({ success: false, message });
        }

        // Mongoose validation errors
        if (err && err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message).join(', ');
            console.error('registerUser validation error:', messages);
            return res.status(400).json({ success: false, message: messages });
        }

        console.error('registerUser error:', err && err.message ? err.message : err);
        return res.status(500).json({ success: false, message: err.message || 'Server Error' });
    }
    // sendToken(user, 200, res)
}

exports.loginUser = async (req, res, next) => {
    const { email, password } = req.body;

    // Checks if email and password is entered by user
    if (!email || !password) {
        return res.status(400).json({ error: 'Please enter email & password' })
    }


    // Finding user in database

    let user = await User.findOne({ email }).select('+password')
    if (!user) {
        return res.status(401).json({ message: 'Invalid Email or Password' })
    }


    // Checks if password is correct or not
    const isPasswordMatched = await user.comparePassword(password);


    if (!isPasswordMatched) {
        return res.status(401).json({ message: 'Invalid Email or Password' })
    }
    const token = user.getJwtToken();

    res.status(201).json({
        success: true,
        token,
        user
    });
    //  user = await User.findOne({ email })
    // sendToken(user, 200, res)
}

exports.forgotPassword = async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return res.status(404).json({ error: 'User not found with this email' })

    }
    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });
    // Create reset password url
    const resetUrl = `${req.protocol}://localhost:5173/password/reset/${resetToken}`;
    const message = `Your password reset token is as follow:\n\n${resetUrl}\n\nIf you have not requested this email, then ignore it.`
    try {
        await sendEmail({
            email: user.email,
            subject: 'RunMate Password Recovery',
            message
        })

        res.status(200).json({
            success: true,
            message: `Email sent to: ${user.email}`
        })

    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
        return res.status(500).json({ error: error.message })
      
    }
}

exports.resetPassword = async (req, res, next) => {
    console.log(req.params.token)
    // Hash URL token
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex')
    const user = await User.findOne({
        // resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    })
    console.log(user)

    if (!user) {
        return res.status(400).json({ message: 'Password reset token is invalid or has been expired' })
        
    }

    if (req.body.password !== req.body.confirmPassword) {
        return res.status(400).json({ message: 'Password does not match' })

    }

    // Setup new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    const token = user.getJwtToken();
    return res.status(201).json({
        success: true,
        token,
        user
    });
   
}

exports.getUserProfile = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    console.log(user)

    return res.status(200).json({
        success: true,
        user
    })
}

exports.updateProfile = async (req, res, next) => {

    const newUserData = {
        name: req.body.name,
        email: req.body.email
    }

    // Update avatar
    if (req.body.avatar !== '') {
        let user = await User.findById(req.user.id)
        // console.log(user)
        const image_id = user.avatar.public_id;
        const res = await cloudinary.v2.uploader.destroy(image_id);
        // console.log("Res", res)
        const result = await cloudinary.v2.uploader.upload(req.body.avatar, {
            folder: 'avatars',
            width: 150,
            crop: "scale"
        })

        newUserData.avatar = {
            public_id: result.public_id,
            url: result.secure_url
        }
    }
    const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
        new: true,
        runValidators: true,
    })
    if (!user) {
        return res.status(401).json({ message: 'User Not Updated' })
    }

    return res.status(200).json({
        success: true,
        user
    })
}

exports.updatePassword = async (req, res, next) => {
    console.log(req.body.password)
    const user = await User.findById(req.user.id).select('+password');
    // Check previous user password
    const isMatched = await user.comparePassword(req.body.oldPassword)
    if (!isMatched) {
        return res.status(400).json({ message: 'Old password is incorrect' })
    }
    user.password = req.body.password;
    await user.save();
    const token = user.getJwtToken();

    return res.status(201).json({
        success: true,
        user,
        token
    });

}

exports.allUsers = async (req, res, next) => {
    const users = await User.find();
    res.status(200).json({
        success: true,
        users
    })
}

exports.deleteUser = async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(401).json({ message: `User does not found with id: ${req.params.id}` })
        // return next(new ErrorHandler(`User does not found with id: ${req.params.id}`))
    }

    // Remove avatar from cloudinary
    const image_id = user.avatar.public_id;
    await cloudinary.v2.uploader.destroy(image_id);
    await User.findByIdAndDelete(req.params.id);
    return res.status(200).json({
        success: true,
    })
}

exports.getUserDetails = async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(400).json({ message: `User does not found with id: ${req.params.id}` })
        // return next(new ErrorHandler(`User does not found with id: ${req.params.id}`))
    }

    res.status(200).json({
        success: true,
        user
    })
}

exports.updateUser = async (req, res, next) => {
    const newUserData = {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role
    }

    const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
        new: true,
        runValidators: true,
        // useFindAndModify: false
    })

    return res.status(200).json({
        success: true
    })
}