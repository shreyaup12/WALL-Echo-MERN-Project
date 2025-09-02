import  User  from "../model/user.model.js";
import bcrypt from "bcryptjs";
import  config  from "../config.js";
import jwt from "jsonwebtoken";


export const signup= async(req, res) => {
    const { firstName, lastName, email, password} = req.body;
    try {
        const user= await User.findOne({ email: email });
        if(user){
            return res.status(401).json({ errors: "User already exists" });
        }
        const hashPassword= await bcrypt.hash(password,10);
        const newuser = new User({
            firstName,
            lastName,
            email,
            password:await hashPassword,
        });
        await newuser.save()
         return res.status(201).json({ message: "User signup succeeded" });
    }
            
    catch (error) {
        console.log("Error in signup:", error);
        return res.status(500).json({ errors: "Error in signup" });
    }
};

export const login=async(req,res) => {
    const { email, password } = req.body;
    try {
        const user= await User.findOne({ email: email });
        
        if(!user){
            return res.status(403).json({ errors: "Invalid credentials" });
        }
        const isPasswordCorrect= await bcrypt.compare(password,user.password);
         if(!isPasswordCorrect){
            return res.status(403).json({ errors: "Invalid credentials" });
        }
        //jwt code
        const token= jwt.sign(
            {id: user._id},config.JWT_USER_PASSWORD,{expiresIn:"1d"}
        );
        const cookiesOptions={
            expires: new Date(
                Date.now()+ 24*60*60*1000
            ),
            httpOnly:true,
            secure:process.env.NODE_ENV==="production",
            sameSite:"Strict"
        };
        res.cookie("jwt",token,cookiesOptions);
        return res.status(201).json({ message: "User login succeeded" ,user,token });
    } catch (error) {
        console.log("Error in login:", error);
        return res.status(500).json({ errors: "Error in login" });
        
    }
};



export const logout=(req,res)=>{
    try { 
        res.clearCookie("jwt");
    return res.status(200).json({ message: "User logged out successfully" });
        
    } catch (error) {
        console.log("Error in logout:", error);
        return res.status(500).json({ errors: "Error in logout" });
        
    }
};
