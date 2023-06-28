import {Box, Button, Fade, List, ListItem, Typography} from "@mui/material";
import { buttonClasses } from '@mui/base/Button';
import { styled } from '@mui/system';
import * as React from "react";
import {Link} from "react-router-dom";
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { Navigate } from "react-router-dom";
import CustomButton from "../CustomButton";
import {useEffect} from "react";
const blue = {
  500: '#007FFF',
  600: '#0072E5',
  700: '#0059B2',
};

const grey = {
  100: '#eaeef2',
  300: '#afb8c1',
  900: '#24292f',
};

interface authProps {
  auth,
  handleLogin,
  userManager
}


const Index = () => {

  const [isVisible, setIsVisible] = React.useState<Boolean>(false)
  const [isVisible2, setIsVisible2] = React.useState<Boolean>(false)

  useEffect(() => {
    setIsVisible(true)
  }, [isVisible]);

  return(
    <>
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      p: 20,
      m: 1,
      flexGrow: 1,
      flexDirection: 'column'
    }}>
      <Fade in={isVisible} appear={true} timeout={1500} addEndListener={() => setTimeout(()=> {
        setIsVisible2(true)
      }, 1000)}>
        <Typography variant={'h3'} sx={{mb: 4, fontWeight: 'bold' }}># Process Improvement eXplorer #</Typography>
      </Fade>
      <Fade in={isVisible} appear={true} timeout={1500} >
        <CustomButton
          key={"get-started"}
          to={"/login"}
          component={Link}

          sx={{ minWidth: '400px', minHeight: '50px', mb: 4}}
          endIcon={<ArrowForwardIosIcon />}
        >
          <Typography
            variant="h6"
          >
            Get Started
          </Typography>
        </CustomButton>
      </Fade>
      <Fade in={isVisible2} appear={false}
            timeout={2500}>
        <List sx={{
            mb: 4,}}>
          <ListItem>
            <Typography
              variant="h4"
              noWrap
              sx={{
                display: { xs: 'none', md: 'flex' },
                fontWeight: 700,
                letterSpacing: '.2rem',
                color: 'text.primary',
                textDecoration: 'none',
              }}
            >
              Project Management
            </Typography>
          </ListItem>
          <ListItem>
            <Typography
              variant="h4"
              noWrap
              sx={{
                display: { xs: 'none', md: 'flex' },
                fontWeight: 700,
                letterSpacing: '.2rem',
                color: 'text.primary',
                textDecoration: 'none',
              }}
            >
              Discovery
            </Typography>
          </ListItem>
          <ListItem>
            <Typography
              variant="h4"
              noWrap
              sx={{
                display: { xs: 'none', md: 'flex' },
                fontWeight: 700,
                letterSpacing: '.2rem',
                color: 'text.primary',
                textDecoration: 'none',
              }}
            >
              Simulation
            </Typography>
          </ListItem>
          <ListItem>
            <Typography
              variant="h4"
              noWrap
              sx={{
                display: { xs: 'none', md: 'flex' },
                fontWeight: 700,
                letterSpacing: '.2rem',
                color: 'text.primary',
                textDecoration: 'none',
              }}
            >
              Optimization
            </Typography>
          </ListItem>
        </List>
      </Fade>
    </Box>
    </>
  )
}

export default Index;